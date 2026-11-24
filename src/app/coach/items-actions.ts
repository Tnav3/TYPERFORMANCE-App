"use server";
// Add / edit / move / delete prescription lines. Shared by program days
// (program_items) and dated workouts (workout_items).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parsePrescription } from "@/lib/prescription";
import { coachOnly, friendly, int, safePath, str, UUID } from "@/lib/programming/server";

const TABLES = {
  program_items: "day_id",
  workout_items: "workout_id",
} as const;
type Table = keyof typeof TABLES;

function target(fd: FormData) {
  const table = String(fd.get("table") ?? "") as Table;
  if (!(table in TABLES)) redirect("/coach");
  const parent = String(fd.get("parent_id") ?? "");
  const back = safePath(fd.get("back"), "/coach");
  return { table, parentCol: TABLES[table], parent, back };
}

function done(back: string, error?: string, anchor?: string): never {
  const [path] = back.split("?");
  revalidatePath(path);
  const sep = back.includes("?") ? "&" : "?";
  redirect(
    error
      ? `${back}${sep}error=${encodeURIComponent(error)}`
      : `${back}${anchor ? `#${anchor}` : ""}`,
  );
}

const nextLetter = (l: string) =>
  l >= "Z" ? "Z" : String.fromCharCode(l.charCodeAt(0) + 1);

async function exerciseByName(
  supabase: Awaited<ReturnType<typeof coachOnly>>,
  name: string,
) {
  const { data } = await supabase
    .from("exercises")
    .select("id, name")
    .ilike("name", name.replace(/[%_\\]/g, (c) => `\\${c}`))
    .limit(1)
    .maybeSingle();
  return data;
}

export async function addItem(fd: FormData) {
  const supabase = await coachOnly();
  const { table, parentCol, parent, back } = target(fd);
  if (!UUID.test(parent)) done(back, "Not found.");
  const kind = fd.get("kind") === "text" ? "text" : "exercise";

  const { data: existing } = await supabase
    .from(table)
    .select("position, block, slot")
    .eq(parentCol, parent)
    .order("position", { ascending: false })
    .limit(1);
  const last = existing?.[0];
  const position = (last?.position ?? 0) + 1;
  const superset = fd.get("superset") === "on" && !!last;
  const block = superset ? last!.block : last ? nextLetter(last.block) : "A";
  const slot = superset ? Math.min(9, last!.slot + 1) : 1;

  let row: Record<string, unknown>;
  if (kind === "text") {
    const title = str(fd.get("title"), 80);
    const notes = str(fd.get("notes"), 2000);
    if (!title && !notes) done(back, "Give the block a title or some notes.");
    row = { kind, title, notes, block, slot };
  } else {
    const name = str(fd.get("exercise"), 80);
    if (!name) done(back, "Pick an exercise.");
    const ex = await exerciseByName(supabase, name!);
    if (!ex) done(back, `"${name}" isn't in the exercise library yet. Add it there first.`);
    const p = parsePrescription(String(fd.get("line") ?? ""));
    row = { kind, exercise_id: ex!.id, block, slot, ...p };
  }
  const { data, error } = await supabase
    .from(table)
    .insert({ ...row, [parentCol]: parent, position })
    .select("id")
    .single();
  if (error) done(back, friendly(error.message));
  done(back, undefined, `item-${data!.id}`);
}

export async function updateItem(fd: FormData) {
  const supabase = await coachOnly();
  const { table, back } = target(fd);
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) done(back, "Not found.");
  const kind = fd.get("kind") === "text" ? "text" : "exercise";
  const block = String(fd.get("block") ?? "A").toUpperCase();
  const slot = int(fd.get("slot")) ?? 1;
  if (!/^[A-Z]$/.test(block) || slot < 1 || slot > 9) done(back, "Block must be a letter and slot 1–9.");

  let row: Record<string, unknown>;
  if (kind === "text") {
    const title = str(fd.get("title"), 80);
    const notes = str(fd.get("notes"), 2000);
    if (!title && !notes) done(back, "Give the block a title or some notes.");
    row = { title, notes, block, slot };
  } else {
    const name = str(fd.get("exercise"), 80);
    const ex = name ? await exerciseByName(supabase, name) : null;
    if (!ex) done(back, `"${name ?? ""}" isn't in the exercise library.`);
    const p = parsePrescription(String(fd.get("line") ?? ""));
    row = { exercise_id: ex!.id, block, slot, ...p };
  }
  const { error } = await supabase.from(table).update(row).eq("id", id);
  done(back, error ? friendly(error.message) : undefined, `item-${id}`);
}

export async function moveItem(fd: FormData) {
  const supabase = await coachOnly();
  const { table, parentCol, parent, back } = target(fd);
  const id = String(fd.get("id") ?? "");
  const dir = fd.get("dir") === "up" ? -1 : 1;
  if (!UUID.test(id) || !UUID.test(parent)) done(back);
  const { data } = await supabase
    .from(table)
    .select("id, position")
    .eq(parentCol, parent)
    .order("position");
  const list = data ?? [];
  const i = list.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) done(back, undefined, `item-${id}`);
  // Renumber everything so positions stay clean, with the two swapped
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(
    list.map((r, k) =>
      r.position === k + 1
        ? null
        : supabase.from(table).update({ position: k + 1 }).eq("id", r.id),
    ),
  );
  done(back, undefined, `item-${id}`);
}

export async function deleteItem(fd: FormData) {
  const supabase = await coachOnly();
  const { table, back } = target(fd);
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) done(back, friendly(error.message));
  }
  done(back);
}

/** Re-letter blocks A, B, C… in order, keeping supersets (same letter, slot > 1) together. */
export async function reletterItems(fd: FormData) {
  const supabase = await coachOnly();
  const { table, parentCol, parent, back } = target(fd);
  if (!UUID.test(parent)) done(back);
  const { data } = await supabase
    .from(table)
    .select("id, block, slot")
    .eq(parentCol, parent)
    .order("position");
  let letter = "@";
  let prevBlock = "";
  let slot = 0;
  const updates = (data ?? []).map((r, k) => {
    const joins = k > 0 && r.block === prevBlock && r.slot > 1;
    prevBlock = r.block;
    if (joins) slot = Math.min(9, slot + 1);
    else {
      letter = nextLetter(letter);
      slot = 1;
    }
    return { id: r.id, block: letter, slot };
  });
  await Promise.all(
    updates.map((u) =>
      supabase.from(table).update({ block: u.block, slot: u.slot }).eq("id", u.id),
    ),
  );
  done(back);
}

/** Label a block (e.g. "Power", "Finisher"). Applies to every item in that block. */
export async function setBlockTitle(fd: FormData) {
  const supabase = await coachOnly();
  const { table, parentCol, parent, back } = target(fd);
  const block = String(fd.get("block") ?? "");
  if (!UUID.test(parent) || !/^[A-Z]$/.test(block)) done(back);
  const { error } = await supabase
    .from(table)
    .update({ block_title: str(fd.get("block_title"), 60) })
    .eq(parentCol, parent)
    .eq("block", block);
  done(back, error ? friendly(error.message) : undefined);
}
