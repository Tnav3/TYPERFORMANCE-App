// Turns a block's workouts into a printable "progression" table: one table per training day,
// one row per exercise slot (A1, B2…), one column per week. Lets a physio see sets, reps
// and how they progress without reading 16 separate sessions.
import { mondayOf } from "@/lib/week";
import { formatPrescription, formatSetPlan, itemLabel } from "@/lib/prescription";

export type PrintWorkout = { id: string; workout_date: string; title: string };
export type PrintItem = {
  workout_id: string; kind: string; block: string; slot: number; position: number;
  title: string | null; notes: string | null; sets: number | null; reps: string | null;
  load_type: string | null; percent: number | null; rpe: number | null; load_kg: number | null;
  tempo: string | null; rest_sec: number | null;
  set_plan: { r: string; p?: number; e?: number; k?: number }[] | null;
  exercises: { name: string } | null;
};
export type Cell = { rx: string; name?: string; note?: string } | null;
export type Row = { label: string; name: string; kind: string; cells: Cell[] };
export type DayTable = { key: string; heading: string; rows: Row[] };

const DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dayIndex = (iso: string) => (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7;

export function rxText(i: PrintItem): string {
  const base = i.set_plan?.length
    ? formatSetPlan(i.set_plan)
    : formatPrescription({
        sets: i.sets, reps: i.reps, load_type: i.load_type as never,
        percent: i.percent != null ? Number(i.percent) : null, rpe: i.rpe != null ? Number(i.rpe) : null,
        load_kg: i.load_kg != null ? Number(i.load_kg) : null, rest_sec: null, tempo: null,
      });
  const extra = [i.tempo ? `tempo ${i.tempo}` : "", i.rest_sec ? `rest ${i.rest_sec >= 60 && i.rest_sec % 60 === 0 ? `${i.rest_sec / 60} min` : `${i.rest_sec}s`}` : ""].filter(Boolean);
  return [base, ...extra].filter(Boolean).join(", ");
}

export function weeksBetween(from: string, to: string): number {
  return Math.max(1, Math.floor((Date.parse(mondayOf(to)) - Date.parse(mondayOf(from))) / 604800000) + 1);
}

export function buildDayTables(workouts: PrintWorkout[], items: PrintItem[], from: string): { weeks: number; days: DayTable[] } {
  if (!workouts.length) return { weeks: 0, days: [] };
  const firstMon = mondayOf(from);
  const weekOf = (d: string) => Math.floor((Date.parse(mondayOf(d)) - Date.parse(firstMon)) / 604800000);
  const weeks = Math.max(...workouts.map((w) => weekOf(w.workout_date))) + 1;
  const byW = new Map<string, PrintItem[]>();
  for (const i of [...items].sort((a, b) => a.position - b.position)) byW.set(i.workout_id, [...(byW.get(i.workout_id) ?? []), i]);

  // A "day" is the weekday plus which session of that day it is (for double days).
  const seen = new Map<string, number>();
  const days = new Map<string, { idx: number; n: number; titles: string[]; rows: Map<string, Row> }>();
  for (const w of [...workouts].sort((a, b) => a.workout_date.localeCompare(b.workout_date))) {
    const dk = `${weekOf(w.workout_date)}|${w.workout_date}`;
    const n = seen.get(dk) ?? 0;
    seen.set(dk, n + 1);
    const idx = dayIndex(w.workout_date);
    const key = `${idx}-${n}`;
    const day = days.get(key) ?? { idx, n, titles: [] as string[], rows: new Map<string, Row>() };
    if (!day.titles.includes(w.title)) day.titles.push(w.title);
    const its = byW.get(w.id) ?? [];
    const sizes = new Map<string, number>();
    for (const i of its) sizes.set(i.block, (sizes.get(i.block) ?? 0) + 1);
    const wk = weekOf(w.workout_date);
    for (const i of its) {
      const label = itemLabel(i, sizes.get(i.block) ?? 1);
      const name = i.kind === "exercise" ? i.exercises?.name ?? i.title ?? "Exercise" : i.title ?? "Note";
      const rowKey = `${label}|${i.kind}`;
      const row = day.rows.get(rowKey) ?? { label, name, kind: i.kind, cells: Array<Cell>(weeks).fill(null) };
      const rx = i.kind === "exercise" ? rxText(i) : (i.notes ?? "").trim();
      row.cells[wk] = { rx, ...(name !== row.name ? { name } : {}), ...(i.kind === "exercise" && i.notes?.trim() ? { note: i.notes.trim() } : {}) };
      day.rows.set(rowKey, row);
    }
    days.set(key, day);
  }
  const ordered = [...days.entries()].sort((a, b) => a[1].idx - b[1].idx || a[1].n - b[1].n);
  return {
    weeks,
    days: ordered.map(([key, d], i) => ({
      key,
      heading: `Day ${i + 1} · ${DOW[d.idx]}${d.n ? ` (session ${d.n + 1})` : ""} · ${d.titles.join(" / ")}`,
      rows: [...d.rows.values()].map((r) => ({ ...r, cells: r.cells.length < weeks ? [...r.cells, ...Array<Cell>(weeks - r.cells.length).fill(null)] : r.cells })),
    })),
  };
}
