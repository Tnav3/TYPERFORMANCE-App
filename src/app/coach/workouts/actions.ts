"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { coachOnly, friendly, ISO_DATE, safePath, str, UUID } from "@/lib/programming/server";

function go(path: string, error?: string): never {
  revalidatePath(path.split(/[?#]/)[0]);
  if (!error) redirect(path);
  const [base, hash] = path.split("#");
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}${hash ? `#${hash}` : ""}`);
}

/** "a:<uuid>" or "g:<uuid>" → columns */
function owner(target: string) {
  const [k, id] = target.split(":");
  if (!UUID.test(id ?? "")) return null;
  if (k === "a") return { athlete_id: id, group_id: null };
  if (k === "g") return { athlete_id: null, group_id: id };
  return null;
}

export async function addWorkout(fd: FormData) {
  const supabase = await coachOnly();
  const back = safePath(fd.get("back"), "/coach");
  const o = owner(String(fd.get("target") ?? ""));
  const date = String(fd.get("date") ?? "");
  const title = str(fd.get("title"), 80) ?? "Workout";
  if (!o) go(back, "Pick a client or group.");
  if (!ISO_DATE.test(date)) go(back, "Pick a date.");
  const { data, error } = await supabase
    .from("workouts")
    .insert({ ...o, workout_date: date, title })
    .select("id")
    .single();
  if (error) go(back, friendly(error.message));
  redirect(`/coach/workouts/${data!.id}`);
}

export async function updateWorkout(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const back = `/coach/workouts/${id}`;
  if (!UUID.test(id)) go("/coach");
  const date = String(fd.get("date") ?? "");
  const title = str(fd.get("title"), 80);
  if (!title) go(back, "Give the workout a title.");
  if (!ISO_DATE.test(date)) go(back, "Pick a date.");
  const { error } = await supabase
    .from("workouts")
    .update({ title, notes: str(fd.get("notes"), 2000), workout_date: date })
    .eq("id", id);
  go(back, error ? friendly(error.message) : undefined);
}

export async function deleteWorkout(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const back = safePath(fd.get("back"), "/coach");
  if (UUID.test(id)) {
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (error) go(`/coach/workouts/${id}`, friendly(error.message));
  }
  go(back);
}

export async function personaliseWorkout(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const athlete = String(fd.get("athlete_id") ?? "");
  if (!UUID.test(id) || !UUID.test(athlete)) go(`/coach/workouts/${id}`, "Pick a client.");
  const { data, error } = await supabase.rpc("override_workout", {
    p_workout: id,
    p_athlete: athlete,
  });
  if (error) go(`/coach/workouts/${id}`, friendly(error.message));
  redirect(`/coach/workouts/${data}`);
}

export async function unassign(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("assignment_id") ?? "");
  const back = safePath(fd.get("back"), "/coach");
  if (!UUID.test(id)) go(back);
  const { data, error } = await supabase.rpc("unassign_program", { p_assignment: id });
  if (error) go(back, friendly(error.message));
  const sep = back.includes("?") ? "&" : "?";
  go(`${back}${sep}removed=${Number(data ?? 0)}`);
}

/** Rename a block on a client's calendar (the program template keeps its own name). */
export async function renameAssignment(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("assignment_id") ?? "");
  const back = safePath(fd.get("back"), "/coach");
  const name = str(fd.get("name"), 60);
  if (!UUID.test(id)) go(back);
  if (!name || name.length < 2) go(back, "Block names need 2–60 characters.");
  const { error } = await supabase.from("assignments").update({ program_name: name }).eq("id", id);
  go(back, error ? friendly(error.message) : undefined);
}

// ---------------- Groups ----------------
export async function createGroup(fd: FormData) {
  const supabase = await coachOnly();
  const name = str(fd.get("name"), 60);
  if (!name || name.length < 2) go("/coach/groups", "Enter a group name.");
  const { data, error } = await supabase.from("groups").insert({ name }).select("id").single();
  if (error) go("/coach/groups", friendly(error.message));
  redirect(`/coach/groups/${data!.id}`);
}

export async function updateGroup(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) go("/coach/groups");
  const patch: Record<string, unknown> = {};
  const name = str(fd.get("name"), 60);
  if (name) patch.name = name;
  if (fd.has("archived")) patch.archived = fd.get("archived") === "true";
  const { error } = await supabase.from("groups").update(patch).eq("id", id);
  go(patch.archived === true ? "/coach/groups" : `/coach/groups/${id}`, error ? friendly(error.message) : undefined);
}

export async function addMember(fd: FormData) {
  const supabase = await coachOnly();
  const group = String(fd.get("group_id") ?? "");
  const athlete = String(fd.get("athlete_id") ?? "");
  if (!UUID.test(group) || !UUID.test(athlete)) go(`/coach/groups/${group}`, "Pick a client.");
  const { error } = await supabase
    .from("group_members")
    .upsert({ group_id: group, athlete_id: athlete }, { onConflict: "group_id,athlete_id", ignoreDuplicates: true });
  go(`/coach/groups/${group}`, error ? friendly(error.message) : undefined);
}

export async function removeMember(fd: FormData) {
  const supabase = await coachOnly();
  const group = String(fd.get("group_id") ?? "");
  const athlete = String(fd.get("athlete_id") ?? "");
  if (UUID.test(group) && UUID.test(athlete))
    await supabase.from("group_members").delete().eq("group_id", group).eq("athlete_id", athlete);
  go(`/coach/groups/${group}`);
}

/** Swap an exercise in a client's/group's assigned workouts from today on (logged ones are left alone). */
export async function swapInAssignment(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("assignment_id") ?? "");
  const back = safePath(fd.get("back"), "/coach");
  const from = String(fd.get("from") ?? "");
  const toName = str(fd.get("to"), 80);
  if (!UUID.test(id) || !UUID.test(from) || !toName) go(back, "Pick both exercises.");
  const { data: to } = await supabase.from("exercises").select("id").ilike("name", toName!).maybeSingle();
  if (!to) go(back, `"${toName}" isn't in the exercise library yet.`);
  const { data, error } = await supabase.rpc("substitute_exercise", { p_scope: "assignment", p_target: id, p_from: from, p_to: to!.id });
  if (error) go(back, friendly(error.message));
  go(`${back}${back.includes("?") ? "&" : "?"}swapped=${Number(data ?? 0)}`);
}

/** Move the remaining (not logged) workouts of an assigned program by N days. */
export async function shiftAssignment(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("assignment_id") ?? "");
  const back = safePath(fd.get("back"), "/coach");
  const days = Number(fd.get("days"));
  const from = String(fd.get("from") ?? "");
  if (!UUID.test(id) || !Number.isInteger(days) || days === 0 || Math.abs(days) > 365 || !ISO_DATE.test(from))
    go(back, "Pick how many days to move it.");
  const { data, error } = await supabase.rpc("shift_assignment", { p_assignment: id, p_days: days, p_from: from });
  if (error) go(back, friendly(error.message));
  go(`${back}${back.includes("?") ? "&" : "?"}shifted=${data ?? 0}`);
}
