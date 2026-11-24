"use server";
// Actions for the spreadsheet-style workout builder. They return results (no redirects)
// so the list can update in place. Shared by program days and dated workouts.
import { revalidatePath } from "next/cache";
import { FIELD_KEYS } from "@/lib/programming/fields";
import { ITEM_COLUMNS, type ItemFields } from "@/lib/programming/types";
import { coachOnly, friendly, UUID } from "@/lib/programming/server";

const TABLES = { program_items: "day_id", workout_items: "workout_id" } as const;
type Table = keyof typeof TABLES;
type Res<T = undefined> = { error?: string; data?: T };
type Supa = Awaited<ReturnType<typeof coachOnly>>;

const LOAD_TYPES = ["percent", "rpe", "kg", "bodyweight", "velocity", "none"] as const;

function check(table: string, parent: string): table is Table {
  return table in TABLES && UUID.test(parent);
}

const letter = (n: number) => String.fromCharCode(65 + Math.min(25, n));

async function findExercise(supabase: Supa, name: string) {
  const { data } = await supabase
    .from("exercises")
    .select("id, name")
    .ilike("name", name.replace(/[%_\\]/g, (c) => `\\${c}`))
    .limit(1)
    .maybeSingle();
  return data;
}

async function fresh(supabase: Supa, table: Table, parent: string) {
  const { data } = await supabase.from(table).select(ITEM_COLUMNS).eq(TABLES[table], parent).order("position");
  return (data ?? []) as unknown as ItemFields[];
}

/** "90", "90s", "1:30", "2m", "2.5m" → seconds */
function restSeconds(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/^\d+:\d{1,2}$/.test(s)) {
    const [m, sec] = s.split(":").map(Number);
    return m * 60 + sec;
  }
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins)$/);
  if (m) return Math.round(Number(m[1]) * 60);
  const sec = s.match(/^(\d+)\s*(s|sec|secs)?$/);
  return sec ? Number(sec[1]) : NaN;
}

export interface RowPatch {
  exercise?: string;
  title?: string | null;
  sets?: string;
  reps?: string;
  load_type?: string;
  load_value?: string;
  rest?: string;
  tempo?: string;
  notes?: string;
  fields?: string[];
  block_title?: string | null;
}

function toRow(p: RowPatch): Res<Record<string, unknown>> {
  const row: Record<string, unknown> = {};
  if (p.sets !== undefined) {
    const n = p.sets.trim() === "" ? null : Number(p.sets);
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 20)) return { error: "Sets must be 1–20." };
    row.sets = n;
  }
  if (p.reps !== undefined) {
    const r = p.reps.trim();
    if (r.length > 20) return { error: "Reps is too long (20 characters max)." };
    row.reps = r || null;
  }
  if (p.load_type !== undefined) {
    const t = (LOAD_TYPES as readonly string[]).includes(p.load_type) ? p.load_type : "none";
    const v = (p.load_value ?? "").trim().replace(",", ".");
    const n = v === "" ? null : Number(v);
    if (n !== null && !Number.isFinite(n)) return { error: "Load must be a number." };
    row.load_type = t;
    row.percent = null;
    row.rpe = null;
    row.load_kg = null;
    row.velocity = null;
    if (t === "percent") {
      if (n == null || n < 1 || n > 120) return { error: "Percent must be 1–120." };
      row.percent = n;
    } else if (t === "rpe") {
      if (n == null || n < 1 || n > 10) return { error: "RPE must be 1–10." };
      row.rpe = n;
    } else if (t === "kg") {
      if (n == null || n < 0 || n > 600) return { error: "Weight must be 0–600 kg." };
      row.load_kg = n;
    } else if (t === "velocity") {
      if (n == null || n < 0.1 || n > 3) return { error: "Bar speed must be 0.1–3 m/s." };
      row.velocity = n;
    }
  }
  if (p.rest !== undefined) {
    const s = restSeconds(p.rest);
    if (s !== null && (!Number.isFinite(s) || s < 0 || s > 1800)) return { error: "Rest: try 90s, 2m or 1:30 (30 min max)." };
    row.rest_sec = s;
  }
  if (p.tempo !== undefined) {
    const t = p.tempo.trim().toUpperCase();
    if (t.length > 10) return { error: "Tempo is 10 characters max." };
    row.tempo = t || null;
  }
  if (p.notes !== undefined) row.notes = p.notes.trim().slice(0, 2000) || null;
  if (p.title !== undefined) row.title = p.title?.trim().slice(0, 80) || null;
  if (p.block_title !== undefined) row.block_title = p.block_title?.trim().slice(0, 60) || null;
  if (p.fields !== undefined) {
    const f = p.fields.filter((x) => (FIELD_KEYS as readonly string[]).includes(x));
    if (f.length > 4) return { error: "Pick up to 4 things to record." };
    row.fields = f.length ? FIELD_KEYS.filter((k) => f.includes(k)) : null;
  }
  return { data: row };
}

function touch(back: string) {
  revalidatePath(back.split(/[?#]/)[0]);
}

export async function builderUpdate(table: string, parent: string, id: string, patch: RowPatch, back: string): Promise<Res<ItemFields[]>> {
  if (!check(table, parent) || !UUID.test(id)) return { error: "Not found." };
  const supabase = await coachOnly();
  const r = toRow(patch);
  if (r.error) return { error: r.error };
  const row = r.data!;
  if (patch.exercise !== undefined) {
    const ex = await findExercise(supabase, patch.exercise.trim());
    if (!ex) return { error: `"${patch.exercise}" isn't in your exercise library.` };
    row.exercise_id = ex.id;
  }
  const { error } = await supabase.from(table).update(row).eq("id", id).eq(TABLES[table], parent);
  if (error) return { error: friendly(error.message) };
  touch(back);
  return { data: await fresh(supabase, table, parent) };
}

export async function builderAdd(
  table: string,
  parent: string,
  input: { kind: "exercise" | "text"; exercise?: string; title?: string; superset?: boolean } & RowPatch,
  back: string,
): Promise<Res<ItemFields[]>> {
  if (!check(table, parent)) return { error: "Not found." };
  const supabase = await coachOnly();
  const list = await fresh(supabase, table, parent);
  const last = list[list.length - 1];
  const blocks = new Set(list.map((i) => i.block)).size;
  const join = !!input.superset && !!last;
  const r = toRow(input);
  if (r.error) return { error: r.error };
  const row: Record<string, unknown> = {
    ...r.data,
    kind: input.kind,
    position: (last?.position ?? 0) + 1,
    block: join ? last!.block : letter(blocks),
    slot: join ? Math.min(9, list.filter((i) => i.block === last!.block).length + 1) : 1,
    [TABLES[table]]: parent,
  };
  if (input.kind === "exercise") {
    const name = (input.exercise ?? "").trim();
    if (!name) return { error: "Pick an exercise." };
    const ex = await findExercise(supabase, name);
    if (!ex) return { error: `"${name}" isn't in your exercise library.` };
    row.exercise_id = ex.id;
  } else if (!row.title && !row.notes) row.title = "Notes";
  const { error } = await supabase.from(table).insert(row);
  if (error) return { error: friendly(error.message) };
  touch(back);
  return { data: await fresh(supabase, table, parent) };
}

export async function builderDelete(table: string, parent: string, ids: string[], back: string): Promise<Res<ItemFields[]>> {
  if (!check(table, parent) || !ids.every((i) => UUID.test(i))) return { error: "Not found." };
  const supabase = await coachOnly();
  const { error } = await supabase.from(table).delete().in("id", ids).eq(TABLES[table], parent);
  if (error) return { error: friendly(error.message) };
  return builderOrder(table, parent, null, back);
}

export async function builderDuplicate(table: string, parent: string, id: string, back: string): Promise<Res<ItemFields[]>> {
  if (!check(table, parent) || !UUID.test(id)) return { error: "Not found." };
  const supabase = await coachOnly();
  const list = await fresh(supabase, table, parent);
  const src = list.find((i) => i.id === id);
  if (!src) return { error: "Not found." };
  const { id: _id, position: _p, ...rest } = src;
  void _id;
  void _p;
  const { data: ins, error } = await supabase
    .from(table)
    .insert({ ...rest, [TABLES[table]]: parent, position: (list[list.length - 1]?.position ?? 0) + 1, block: "Z", slot: 1 })
    .select("id")
    .single();
  if (error) return { error: friendly(error.message) };
  // Place the copy straight after the original, as its own block
  const order = list.flatMap((i, k) => {
    const join = k > 0 && i.block === list[k - 1].block;
    return i.id === id ? [{ id: i.id, join }, { id: ins!.id, join: false }] : [{ id: i.id, join }];
  });
  return builderOrder(table, parent, order, back);
}

/**
 * Save order + superset grouping. Each row says whether it joins the row above it.
 * Letters and slots are rebuilt A, B, C…; block labels follow the first row of each group.
 * With `order` null, the current order is kept and only relettered.
 */
export async function builderOrder(
  table: string,
  parent: string,
  order: { id: string; join: boolean }[] | null,
  back: string,
): Promise<Res<ItemFields[]>> {
  if (!check(table, parent)) return { error: "Not found." };
  const supabase = await coachOnly();
  const list = await fresh(supabase, table, parent);
  const byId = new Map(list.map((i) => [i.id, i]));
  const seq =
    order?.filter((o) => byId.has(o.id)) ??
    list.map((i, k) => ({ id: i.id, join: k > 0 && i.block === list[k - 1].block }));
  if (order && (seq.length !== list.length || new Set(seq.map((s) => s.id)).size !== list.length)) {
    return { error: "The list changed. Refresh and try again." };
  }
  let b = -1;
  let slot = 0;
  let groupTitle: string | null = null;
  const updates = seq.map((s, k) => {
    const it = byId.get(s.id)!;
    if (k === 0 || !s.join || slot >= 9) {
      b++;
      slot = 1;
      groupTitle = it.block_title ?? null;
    } else slot++;
    return { id: s.id, position: k + 1, block: letter(b), slot, block_title: groupTitle };
  });
  const res = await Promise.all(
    updates.map((u) =>
      supabase.from(table).update({ position: u.position, block: u.block, slot: u.slot, block_title: u.block_title }).eq("id", u.id),
    ),
  );
  const e2 = res.find((r) => r.error)?.error;
  if (e2) return { error: friendly(e2.message) };
  touch(back);
  return { data: await fresh(supabase, table, parent) };
}

/** Add a missing exercise to the library straight from the builder. */
export async function quickAddExercise(name: string, category: string): Promise<Res<{ id: string; name: string }>> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > 80) return { error: "Exercise name must be 2–80 characters." };
  const cats = ["strength", "power", "plyometric", "conditioning", "mobility", "core", "accessory"];
  const cat = cats.includes(category) ? category : "accessory";
  const supabase = await coachOnly();
  const existing = await findExercise(supabase, clean);
  if (existing) return { data: existing };
  const measure = cat === "conditioning" || cat === "mobility" ? "time" : "load";
  const { data, error } = await supabase
    .from("exercises")
    .insert({ name: clean, category: cat, measure })
    .select("id, name")
    .single();
  if (error) return { error: friendly(error.message) };
  revalidatePath("/coach/library");
  return { data: data! };
}
