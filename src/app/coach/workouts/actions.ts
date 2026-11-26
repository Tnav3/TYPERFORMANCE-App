"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addDays, mondayOf } from "@/lib/week";
import { todayISO } from "@/lib/dates";
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

/** How many weeks ahead the client can see this block ("" = all of it). */
export async function setRevealWeeks(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("assignment_id") ?? "");
  const back = safePath(fd.get("back"), "/coach");
  const raw = String(fd.get("weeks") ?? "");
  const n = raw === "" ? null : Number(raw);
  if (!UUID.test(id) || (n != null && !(Number.isInteger(n) && n >= 1 && n <= 12))) go(back);
  const { error } = await supabase.from("assignments").update({ reveal_weeks: n, reveal_weekly: false }).eq("id", id);
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
  if (fd.has("show_activity")) patch.show_activity = fd.get("show_activity") === "true";
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
  // One day only, or every upcoming day in the block
  const oneDay = String(fd.get("workout_id") ?? "");
  const { data, error } = UUID.test(oneDay)
    ? await supabase.rpc("substitute_exercise", { p_scope: "workout", p_target: oneDay, p_from: from, p_to: to!.id })
    : await supabase.rpc("substitute_exercise", { p_scope: "assignment", p_target: id, p_from: from, p_to: to!.id });
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

/** Add an empty day to a client's block from the overview, then open it to program. */
export async function addBlockDay(fd: FormData) {
  const supabase = await coachOnly();
  const back = safePath(fd.get("back"), "/coach");
  const id = String(fd.get("assignment_id") ?? "");
  const date = String(fd.get("date") ?? "");
  if (!UUID.test(id)) go(back);
  if (!ISO_DATE.test(date)) go(back, "Pick a date.");
  const { data: a, error: aErr } = await supabase.from("assignments").select("athlete_id").eq("id", id).single();
  if (aErr || !a?.athlete_id) go(back, "That block isn't on a client's calendar.");
  const { count } = await supabase.from("workouts").select("id", { count: "exact", head: true }).eq("assignment_id", id);
  const { data, error } = await supabase
    .from("workouts")
    .insert({ athlete_id: a!.athlete_id, assignment_id: id, workout_date: date, title: `Day ${(count ?? 0) + 1}` })
    .select("id")
    .single();
  if (error) go(back, friendly(error.message));
  revalidatePath(back.split(/[?#]/)[0]);
  redirect(`/coach/workouts/${data!.id}?ret=programming&block=${id}`);
}

/**
 * Change how many weeks a client's block runs.
 * Shorter: removes upcoming, unlogged days after the new last week (logged days stay).
 * Longer: copies the block's last week into each new week.
 */
export async function setBlockLength(fd: FormData) {
  const supabase = await coachOnly();
  const back = safePath(fd.get("back"), "/coach");
  const id = String(fd.get("assignment_id") ?? "");
  const weeks = Number(fd.get("weeks"));
  if (!UUID.test(id)) go(back);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 26) go(back, "Pick 1 to 26 weeks.");
  const { data: ws, error } = await supabase
    .from("workouts")
    .select("id, athlete_id, workout_date, position, title, notes")
    .eq("assignment_id", id)
    .is("overrides_id", null)
    .not("athlete_id", "is", null)
    .order("workout_date");
  if (error) go(back, friendly(error.message));
  if (!ws?.length) go(back, "Add a day to this block first, then set its length.");
  const firstMon = mondayOf(ws![0].workout_date);
  const lastMon = mondayOf(ws![ws!.length - 1].workout_date);
  const current = Math.round((Date.parse(lastMon) - Date.parse(firstMon)) / 604800000) + 1;
  const sep = back.includes("?") ? "&" : "?";
  if (weeks === current) go(back);

  if (weeks < current) {
    const cutoff = addDays(firstMon, weeks * 7);
    const today = todayISO();
    const cut = ws!.filter((w) => w.workout_date >= cutoff);
    const { data: logs } = await supabase.from("workout_logs").select("workout_id").in("workout_id", cut.map((w) => w.id));
    const logged = new Set((logs ?? []).map((l) => l.workout_id as string));
    const remove = cut.filter((w) => !logged.has(w.id) && w.workout_date >= today).map((w) => w.id);
    const kept = cut.length - remove.length;
    if (remove.length) {
      const { error: dErr } = await supabase.from("workouts").delete().in("id", remove);
      if (dErr) go(back, friendly(dErr.message));
    }
    go(`${back}${sep}length=${weeks}${kept ? `&kept=${kept}` : ""}`);
  }

  // Longer: copy the last week forward
  const src = ws!.filter((w) => w.workout_date >= lastMon);
  const { data: items, error: iErr } = await supabase
    .from("workout_items")
    .select("workout_id, position, kind, exercise_id, block, slot, sets, reps, load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan")
    .in("workout_id", src.map((w) => w.id));
  if (iErr) go(back, friendly(iErr.message));
  for (let k = 1; k <= weeks - current; k++) {
    for (const w of src) {
      const { data: nw, error: wErr } = await supabase
        .from("workouts")
        .insert({ athlete_id: w.athlete_id, assignment_id: id, workout_date: addDays(w.workout_date, k * 7), position: w.position, title: w.title, notes: w.notes })
        .select("id")
        .single();
      if (wErr) go(back, friendly(wErr.message));
      const rows = (items ?? []).filter((i) => i.workout_id === w.id).map((i) => ({ ...Object.fromEntries(Object.entries(i).filter(([k]) => k !== "workout_id")), workout_id: nw!.id }));
      if (rows.length) {
        const { error: rErr } = await supabase.from("workout_items").insert(rows);
        if (rErr) go(back, friendly(rErr.message));
      }
    }
  }
  go(`${back}${sep}length=${weeks}`);
}
