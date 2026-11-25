"use server";
// Actions for the spreadsheet-style workout builder. They return results (no redirects)
// so the list can update in place. Shared by program days and dated workouts.
import { revalidatePath } from "next/cache";
import { FIELD_KEYS, MAX_FIELDS } from "@/lib/programming/fields";
import { ITEM_COLUMNS, isCategory, type ItemFields, type SetTarget } from "@/lib/programming/types";
import { schemeRow } from "@/lib/programming/schemes";
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
    .select("id, name, default_sets, default_reps, default_load_type, default_load_value, default_rest_sec")
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
  // Typing sets/reps/load by hand replaces any loading-scheme plan on this line
  if (p.sets !== undefined || p.reps !== undefined || p.load_type !== undefined) row.set_plan = null;
  if (p.fields !== undefined) {
    const f = p.fields.filter((x) => (FIELD_KEYS as readonly string[]).includes(x));
    if (f.length > MAX_FIELDS) return { error: `Pick up to ${MAX_FIELDS} things to record.` };
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

/** Change how an exercise shows distance or speed (applies to that exercise everywhere). */
export async function builderSetUnits(exerciseId: string, key: "distance_unit" | "speed_unit", value: string, back: string): Promise<Res> {
  if (!UUID.test(exerciseId)) return { error: "Not found." };
  const ok = key === "distance_unit" ? ["m", "km", "mi", "yd"] : key === "speed_unit" ? ["ms", "kmh", "mph"] : [];
  if (!ok.includes(value)) return { error: "Pick a unit." };
  const supabase = await coachOnly();
  const { error } = await supabase.from("exercises").update({ [key]: value }).eq("id", exerciseId);
  if (error) return { error: friendly(error.message) };
  touch(back);
  return {};
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
    const blank = !input.sets?.trim() && !input.reps?.trim() && (!input.load_type || input.load_type === "none") && !input.rest?.trim();
    if (blank) {
      const d = toRow({
        sets: ex.default_sets != null ? String(ex.default_sets) : "",
        reps: ex.default_reps ?? "",
        load_type: ex.default_load_type ?? "none",
        load_value: ex.default_load_value != null ? String(ex.default_load_value) : "",
        rest: ex.default_rest_sec != null ? String(ex.default_rest_sec) : "",
      });
      if (d.data) Object.assign(row, d.data);
    }
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
  // Unknown → let the database sort it from the name.
  const cat = isCategory(category) ? category : "auto";
  const supabase = await coachOnly();
  const existing = await findExercise(supabase, clean);
  if (existing) return { data: existing };
  const measure = cat === "cond_mob" ? "time" : "load";
  const { data, error } = await supabase
    .from("exercises")
    .insert({ name: clean, category: cat, measure })
    .select("id, name")
    .single();
  if (error) return { error: friendly(error.message) };
  revalidatePath("/coach/library");
  return { data: data! };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Program days only: copy this line to the same day in every later week, with an optional
 * weekly progression. Matching lines (same exercise, same day) are updated; missing ones are added.
 */
export async function builderApplyWeeks(
  dayId: string,
  itemId: string,
  opts: { mode: "same" | "load" | "reps" | "sets"; step: string; skipLast: boolean },
  back: string,
): Promise<Res<{ weeks: number[] }>> {
  if (!UUID.test(dayId) || !UUID.test(itemId)) return { error: "Not found." };
  const step = Number(String(opts.step).replace(",", ".")) || 0;
  const supabase = await coachOnly();
  const { data: day } = await supabase.from("program_days").select("id, program_id, week_no, day_no, title").eq("id", dayId).maybeSingle();
  const { data: src } = await supabase.from("program_items").select("*").eq("id", itemId).eq("day_id", dayId).maybeSingle();
  if (!day || !src) return { error: "Not found." };
  if (src.kind !== "exercise") return { error: "Only exercise lines can be pushed to other weeks." };
  const { data: prog } = await supabase.from("programs").select("weeks").eq("id", day.program_id).maybeSingle();
  const last = (prog?.weeks ?? day.week_no) - (opts.skipLast ? 1 : 0);
  const done: number[] = [];
  for (let w = day.week_no + 1; w <= last; w++) {
    const n = w - day.week_no;
    const p = {
      sets: src.sets as number | null,
      reps: src.reps as string | null,
      load_type: src.load_type,
      percent: src.percent == null ? null : Number(src.percent),
      rpe: src.rpe == null ? null : Number(src.rpe),
      load_kg: src.load_kg == null ? null : Number(src.load_kg),
      velocity: src.velocity == null ? null : Number(src.velocity),
      tempo: src.tempo,
      rest_sec: src.rest_sec,
      notes: src.notes,
      fields: src.fields,
      set_plan: src.set_plan,
    };
    if (opts.mode === "load") {
      if (p.load_type === "percent" && p.percent != null) p.percent = r2(clamp(p.percent + step * n, 1, 120));
      else if (p.load_type === "kg" && p.load_kg != null) p.load_kg = r2(clamp(p.load_kg + step * n, 0, 600));
      else if (p.load_type === "rpe" && p.rpe != null) p.rpe = r2(clamp(p.rpe + step * n, 1, 10));
      else if (p.load_type === "velocity" && p.velocity != null) p.velocity = r2(clamp(p.velocity - Math.abs(step) * n, 0.1, 3));
    } else if (opts.mode === "reps" && p.reps && /^\d+$/.test(p.reps.trim())) {
      p.reps = String(clamp(Number(p.reps) + Math.round(step) * n, 1, 100));
    } else if (opts.mode === "sets" && p.sets != null) {
      p.sets = clamp(p.sets + Math.round(step) * n, 1, 20);
    }
    // the same day in week w
    let { data: target } = await supabase
      .from("program_days")
      .select("id")
      .eq("program_id", day.program_id)
      .eq("week_no", w)
      .eq("day_no", day.day_no)
      .maybeSingle();
    if (!target) {
      const ins = await supabase
        .from("program_days")
        .insert({ program_id: day.program_id, week_no: w, day_no: day.day_no, title: day.title })
        .select("id")
        .single();
      if (ins.error) return { error: friendly(ins.error.message) };
      target = ins.data;
    }
    const { data: match } = await supabase
      .from("program_items")
      .select("id")
      .eq("day_id", target!.id)
      .eq("exercise_id", src.exercise_id)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (match) {
      const { error } = await supabase.from("program_items").update(p).eq("id", match.id);
      if (error) return { error: friendly(error.message) };
    } else {
      const list = await fresh(supabase, "program_items", target!.id);
      const blocks = new Set(list.map((i) => i.block)).size;
      const { error } = await supabase.from("program_items").insert({
        ...p,
        day_id: target!.id,
        kind: "exercise",
        exercise_id: src.exercise_id,
        position: (list[list.length - 1]?.position ?? 0) + 1,
        block: letter(blocks),
        slot: 1,
        block_title: src.block_title,
      });
      if (error) return { error: friendly(error.message) };
    }
    done.push(w);
  }
  revalidatePath(`/coach/programs/${day.program_id}`);
  touch(back);
  return { data: { weeks: done } };
}

const BLOCK_COLS = ["kind", "exercise_id", "sets", "reps", "load_type", "percent", "rpe", "load_kg", "velocity", "tempo", "rest_sec", "title", "notes", "block_title", "fields", "set_plan"] as const;

export async function listSavedBlocks(): Promise<Res<{ id: string; name: string; count: number }[]>> {
  const supabase = await coachOnly();
  const { data, error } = await supabase.from("saved_blocks").select("id, name, items").order("name");
  if (error) return { error: friendly(error.message) };
  return { data: (data ?? []).map((b) => ({ id: b.id, name: b.name, count: (b.items as unknown[]).length })) };
}

/** Save the ticked rows (in order, keeping supersets) as a reusable block. */
export async function saveBlock(table: string, parent: string, ids: string[], name: string): Promise<Res<{ id: string; name: string; count: number }>> {
  if (!check(table, parent) || !ids.length || !ids.every((i) => UUID.test(i))) return { error: "Tick the rows to save first." };
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 60) return { error: "Name the block (2–60 characters)." };
  const supabase = await coachOnly();
  const list = (await fresh(supabase, table, parent)).filter((i) => ids.includes(i.id));
  const items = list.map((i, k) => {
    const o: Record<string, unknown> = { join: k > 0 && i.block === list[k - 1].block };
    for (const c of BLOCK_COLS) o[c] = (i as unknown as Record<string, unknown>)[c] ?? null;
    return o;
  });
  const { data, error } = await supabase.from("saved_blocks").insert({ name: clean, items }).select("id, name").single();
  if (error) return { error: friendly(error.message) };
  return { data: { id: data!.id, name: data!.name, count: items.length } };
}

/** Append a saved block to the end of this day. */
export async function insertBlock(table: string, parent: string, blockId: string, back: string): Promise<Res<ItemFields[]>> {
  if (!check(table, parent) || !UUID.test(blockId)) return { error: "Not found." };
  const supabase = await coachOnly();
  const { data: b } = await supabase.from("saved_blocks").select("items").eq("id", blockId).maybeSingle();
  if (!b) return { error: "Saved block not found." };
  const list = await fresh(supabase, table, parent);
  let pos = list[list.length - 1]?.position ?? 0;
  let bi = new Set(list.map((i) => i.block)).size - 1;
  let slot = 0;
  const rows = (b.items as Record<string, unknown>[]).map((it, k) => {
    if (k === 0 || !it.join || slot >= 9) {
      bi++;
      slot = 1;
    } else slot++;
    const row: Record<string, unknown> = { [TABLES[table]]: parent, position: ++pos, block: letter(bi), slot };
    for (const c of BLOCK_COLS) row[c] = it[c] ?? null;
    if (row.kind !== "exercise") row.kind = "text";
    if (!row.load_type) row.load_type = "none";
    return row;
  });
  const { error } = await supabase.from(table).insert(rows);
  if (error) return { error: friendly(error.message) };
  touch(back);
  return { data: await fresh(supabase, table, parent) };
}

export async function deleteSavedBlock(id: string): Promise<Res> {
  if (!UUID.test(id)) return { error: "Not found." };
  const supabase = await coachOnly();
  const { error } = await supabase.from("saved_blocks").delete().eq("id", id);
  return error ? { error: friendly(error.message) } : {};
}

// ---------- Loading schemes ----------
type Scheme = { id: string; name: string; load_type: "percent" | "rpe" | "none"; weeks: SetTarget[][] };

export async function builderApplyScheme(
  table: "program_items" | "workout_items",
  parentId: string,
  itemId: string,
  schemeId: string | null,
  back: string,
): Promise<Res<{ weeks: number }>> {
  if (!UUID.test(parentId) || !UUID.test(itemId) || (schemeId && !UUID.test(schemeId))) return { error: "Not found." };
  const supabase = await coachOnly();
  const parentCol = table === "program_items" ? "day_id" : "workout_id";
  const { data: src } = await supabase.from(table).select("*").eq("id", itemId).eq(parentCol, parentId).maybeSingle();
  if (!src || src.kind !== "exercise") return { error: "Pick an exercise line." };
  if (!schemeId) {
    const { error } = await supabase.from(table).update({ set_plan: null }).eq("id", itemId);
    touch(back);
    return error ? { error: friendly(error.message) } : { data: { weeks: 1 } };
  }
  const { data: s } = await supabase.from("loading_schemes").select("id, name, load_type, weeks").eq("id", schemeId).maybeSingle<Scheme>();
  if (!s) return { error: "Scheme not found." };
  const planFor = (i: number) => s.weeks[i % s.weeks.length];

  // Targets: [itemId for this week, then the same exercise on the same day in later weeks]
  const targets: string[] = [itemId];
  if (table === "program_items") {
    const { data: day } = await supabase.from("program_days").select("program_id, week_no, day_no").eq("id", parentId).single();
    const { data: later } = await supabase
      .from("program_days")
      .select("id, week_no, program_items(id, exercise_id, position)")
      .eq("program_id", day!.program_id)
      .eq("day_no", day!.day_no)
      .gt("week_no", day!.week_no)
      .order("week_no");
    for (const d of later ?? []) {
      const m = ((d.program_items ?? []) as { id: string; exercise_id: string | null; position: number }[])
        .filter((x) => x.exercise_id === src.exercise_id)
        .sort((a, b) => a.position - b.position)[0];
      if (m) targets.push(m.id);
    }
  } else {
    const { data: w } = await supabase.from("workouts").select("assignment_id, athlete_id, workout_date").eq("id", parentId).single();
    if (w?.assignment_id) {
      const { data: later } = await supabase
        .from("workouts")
        .select("id, workout_date, workout_items(id, exercise_id, position)")
        .eq("assignment_id", w.assignment_id)
        .gt("workout_date", w.workout_date)
        .order("workout_date");
      const dow = new Date(`${w.workout_date}T00:00:00Z`).getUTCDay();
      for (const x of later ?? []) {
        if (new Date(`${x.workout_date}T00:00:00Z`).getUTCDay() !== dow) continue;
        const m = ((x.workout_items ?? []) as { id: string; exercise_id: string | null; position: number }[])
          .filter((y) => y.exercise_id === src.exercise_id)
          .sort((a, b) => a.position - b.position)[0];
        if (m) targets.push(m.id);
      }
    }
  }
  for (let i = 0; i < targets.length; i++) {
    const row = schemeRow(planFor(i), s.load_type);
    const { error } = await supabase.from(table).update(row).eq("id", targets[i]);
    if (error) return { error: friendly(error.message) };
  }
  touch(back);
  return { data: { weeks: targets.length } };
}

export async function listSchemes(): Promise<Res<{ id: string; name: string; weeks: number }[]>> {
  const supabase = await coachOnly();
  const { data, error } = await supabase.from("loading_schemes").select("id, name, weeks").order("sort").order("name");
  if (error) return { error: friendly(error.message) };
  return { data: (data ?? []).map((s) => ({ id: s.id, name: s.name, weeks: (s.weeks as unknown[]).length })) };
}
