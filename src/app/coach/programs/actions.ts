"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  coachOnly,
  dec,
  friendly,
  int,
  ISO_DATE,
  safePath,
  str,
  UUID,
} from "@/lib/programming/server";

const LIST = "/coach/programs";
const progPath = (id: string) => `${LIST}/${id}`;

function go(path: string, error?: string): never {
  revalidatePath(path.split("?")[0].split("#")[0]);
  if (!error) redirect(path);
  const [base, hash] = path.split("#");
  const sep = base.includes("?") ? "&" : "?";
  redirect(`${base}${sep}error=${encodeURIComponent(error)}${hash ? `#${hash}` : ""}`);
}

const folderOf = (fd: FormData) => {
  const f = String(fd.get("folder_id") ?? "");
  return UUID.test(f) ? f : null;
};
const inFolder = (f: string | null) => (f ? `${LIST}?f=${f}` : LIST);

// ---------------- Folders ----------------
export async function createFolder(fd: FormData) {
  const supabase = await coachOnly();
  const parent = folderOf(fd);
  const name = str(fd.get("name"), 60);
  if (!name) go(inFolder(parent), "Enter a folder name.");
  const { error } = await supabase.from("program_folders").insert({ name, parent_id: parent });
  go(inFolder(parent), error ? friendly(error.message) : undefined);
}

export async function renameFolder(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const name = str(fd.get("name"), 60);
  const back = inFolder(folderOf(fd));
  if (!UUID.test(id) || !name) go(back, "Enter a folder name.");
  const { error } = await supabase.from("program_folders").update({ name }).eq("id", id);
  go(back, error ? friendly(error.message) : undefined);
}

/** Subfolders go too; programs inside are kept and move to the top level. */
export async function deleteFolder(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const back = inFolder(folderOf(fd));
  if (!UUID.test(id)) go(back);
  const { error } = await supabase.from("program_folders").delete().eq("id", id);
  go(back, error ? friendly(error.message) : undefined);
}

export async function moveProgram(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const to = String(fd.get("to") ?? "");
  const back = inFolder(folderOf(fd));
  if (!UUID.test(id)) go(back);
  const { error } = await supabase.from("programs").update({ folder_id: UUID.test(to) ? to : null }).eq("id", id);
  go(back, error ? friendly(error.message) : undefined);
}

export async function createProgram(fd: FormData) {
  const supabase = await coachOnly();
  const name = str(fd.get("name"), 80);
  const weeks = int(fd.get("weeks")) ?? 4;
  if (!name || name.length < 2) go(LIST, "Enter a program name.");
  if (weeks < 1 || weeks > 52) go(LIST, "Weeks must be 1–52.");
  const master = String(fd.get("from_master") ?? "");
  if (UUID.test(master)) {
    const { data: copy, error: e } = await supabase.rpc("duplicate_program", { p_program: master, p_name: name });
    if (e) go(LIST, friendly(e.message));
    await supabase.from("programs").update({ is_master: false, tag: str(fd.get("tag"), 40), folder_id: folderOf(fd) }).eq("id", copy);
    go(progPath(String(copy)));
  }
  const { data, error } = await supabase
    .from("programs")
    .insert({ name, weeks, tag: str(fd.get("tag"), 40), folder_id: folderOf(fd) })
    .select("id")
    .single();
  if (error) go(LIST, friendly(error.message));
  go(progPath(data!.id));
}

export async function updateProgram(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) go(LIST);
  const name = str(fd.get("name"), 80);
  const weeks = int(fd.get("weeks"));
  if (!name || name.length < 2) go(progPath(id), "Enter a program name.");
  if (!weeks || weeks < 1 || weeks > 52) go(progPath(id), "Weeks must be 1–52.");
  const { error } = await supabase
    .from("programs")
    .update({
      name,
      weeks,
      tag: str(fd.get("tag"), 40),
      description: str(fd.get("description"), 2000),
      instructions: str(fd.get("instructions"), 5000),
      reveal_weekly: fd.get("reveal_weekly") === "on",
    })
    .eq("id", id);
  go(progPath(id), error ? friendly(error.message) : undefined);
}

export async function setProgramArchived(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id))
    await supabase
      .from("programs")
      .update({ archived: fd.get("archived") === "true" })
      .eq("id", id);
  go(LIST);
}

export async function duplicateProgram(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const name = str(fd.get("name"), 80);
  if (!UUID.test(id) || !name) go(LIST, "Enter a name for the copy.");
  const { data, error } = await supabase.rpc("duplicate_program", {
    p_program: id,
    p_name: name,
  });
  if (error) go(LIST, friendly(error.message));
  go(progPath(String(data)));
}

export async function deleteProgram(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (fd.get("confirm") !== "DELETE") go(progPath(id), 'Type DELETE to confirm.');
  if (UUID.test(id)) {
    const { error } = await supabase.from("programs").delete().eq("id", id);
    if (error) go(progPath(id), friendly(error.message));
  }
  go(LIST);
}

/** Make sure a program day exists, then open its editor. */
export async function openDay(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("program_id") ?? "");
  const week = int(fd.get("week")) ?? 0;
  const day = int(fd.get("day")) ?? 0;
  if (!UUID.test(id) || week < 1 || day < 1 || day > 7) go(LIST);
  const { data } = await supabase
    .from("program_days")
    .select("id")
    .eq("program_id", id)
    .eq("week_no", week)
    .eq("day_no", day)
    .maybeSingle();
  let dayId = data?.id as string | undefined;
  if (!dayId) {
    const { data: created, error } = await supabase
      .from("program_days")
      .insert({ program_id: id, week_no: week, day_no: day })
      .select("id")
      .single();
    if (error) go(progPath(id), friendly(error.message));
    dayId = created!.id;
  }
  redirect(`${progPath(id)}/day/${dayId}`);
}

export async function updateDay(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const back = safePath(fd.get("back"), LIST);
  if (!UUID.test(id)) go(back);
  const { error } = await supabase
    .from("program_days")
    .update({ title: str(fd.get("title"), 80), notes: str(fd.get("notes"), 2000) })
    .eq("id", id);
  go(back, error ? friendly(error.message) : undefined);
}

/** Clear a day (makes it a rest day). */
export async function clearDay(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const programId = String(fd.get("program_id") ?? "");
  if (UUID.test(id)) await supabase.from("program_days").delete().eq("id", id);
  go(UUID.test(programId) ? progPath(programId) : LIST);
}

/** Copy a day's content onto another week/day slot of the same program. */
export async function copyDay(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const programId = String(fd.get("program_id") ?? "");
  const week = int(fd.get("to_week")) ?? 0;
  const day = int(fd.get("to_day")) ?? 0;
  const back = safePath(fd.get("back"), LIST);
  if (!UUID.test(id) || !UUID.test(programId) || week < 1 || day < 1 || day > 7)
    go(back, "Pick a week and day.");
  const { data: src } = await supabase
    .from("program_days")
    .select("title, notes, program_items(position, kind, exercise_id, block, slot, sets, reps, load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields)")
    .eq("id", id)
    .single();
  if (!src) go(back, "Day not found.");
  await supabase
    .from("program_days")
    .delete()
    .eq("program_id", programId)
    .eq("week_no", week)
    .eq("day_no", day);
  const { data: created, error } = await supabase
    .from("program_days")
    .insert({ program_id: programId, week_no: week, day_no: day, title: src!.title, notes: src!.notes })
    .select("id")
    .single();
  if (error) go(back, friendly(error.message));
  const items = (src!.program_items ?? []) as Record<string, unknown>[];
  if (items.length)
    await supabase
      .from("program_items")
      .insert(items.map((i) => ({ ...i, day_id: created!.id })));
  go(`${progPath(programId)}?copied=W${week}D${day}`);
}

export async function copyWeek(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("program_id") ?? "");
  const from = int(fd.get("from")) ?? 0;
  const to = int(fd.get("to")) ?? 0;
  if (!UUID.test(id)) go(LIST);
  if (from < 1 || to < 1) go(progPath(id), "Pick the weeks.");
  const progress = fd.get("progress") === "on";
  const { error } = progress
    ? await supabase.rpc("progress_program_week", {
        p_program: id,
        p_from: from,
        p_to: to,
        p_pct: dec(fd.get("pct")) ?? 0,
        p_rpe: dec(fd.get("rpe")) ?? 0,
        p_sets: int(fd.get("sets")) ?? 0,
        p_kg: dec(fd.get("kg")) ?? 0,
      })
    : await supabase.rpc("copy_program_week", { p_program: id, p_from: from, p_to: to });
  go(`${progPath(id)}#week-${to}`, error ? friendly(error.message) : undefined);
}

export async function assignProgram(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("program_id") ?? "");
  const target = String(fd.get("target") ?? "");
  const start = String(fd.get("start") ?? "");
  if (!UUID.test(id)) go(LIST);
  const [kind, targetId] = target.split(":");
  if (!["a", "g"].includes(kind) || !UUID.test(targetId ?? ""))
    go(progPath(id), "Pick a client or a group.");
  if (!ISO_DATE.test(start)) go(progPath(id), "Pick a start date.");
  const { error } = await supabase.rpc("assign_program", {
    p_program: id,
    p_athlete: kind === "a" ? targetId : null,
    p_group: kind === "g" ? targetId : null,
    p_start: start,
  });
  if (error) go(progPath(id), friendly(error.message));
  go(kind === "a" ? `/coach/athlete/${targetId}/program?from=${start}` : `/coach/groups/${targetId}?from=${start}`);
}

/** Copy a program into the master template library. */
export async function saveAsMaster(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const name = str(fd.get("name"), 80);
  if (!UUID.test(id) || !name) go(LIST, "Name the master template.");
  const { data, error } = await supabase.rpc("duplicate_program", { p_program: id, p_name: name });
  if (error) go(LIST, friendly(error.message));
  await supabase.from("programs").update({ is_master: true }).eq("id", data);
  go(`${LIST}?view=masters`);
}

/** Swap one exercise for another across the whole program, keeping prescriptions. */
export async function swapInProgram(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("program_id") ?? "");
  const from = String(fd.get("from") ?? "");
  const toName = str(fd.get("to"), 80);
  if (!UUID.test(id) || !UUID.test(from) || !toName) go(progPath(id), "Pick both exercises.");
  const { data: to } = await supabase.from("exercises").select("id").ilike("name", toName!.replace(/[%_\\]/g, (c) => `\\${c}`)).maybeSingle();
  if (!to) go(progPath(id), `"${toName}" isn't in the exercise library yet.`);
  const { data, error } = await supabase.rpc("substitute_exercise", { p_scope: "program", p_target: id, p_from: from, p_to: to!.id });
  go(`${progPath(id)}?swapped=${Number(data ?? 0)}`, error ? friendly(error.message) : undefined);
}
