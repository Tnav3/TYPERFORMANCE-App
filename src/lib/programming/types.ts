import type { LoadType } from "@/lib/prescription";

export const EXERCISE_CATEGORIES = [
  ["strength", "Strength"],
  ["power", "Power"],
  ["plyometric", "Plyometric"],
  ["conditioning", "Conditioning"],
  ["core", "Core"],
  ["accessory", "Accessory"],
  ["mobility", "Mobility"],
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number][0];

export const MEASURES = [
  ["load", "Weight × reps"],
  ["bodyweight", "Bodyweight reps"],
  ["time", "Time"],
  ["distance", "Distance"],
  ["calories", "Calories"],
] as const;
export type Measure = (typeof MEASURES)[number][0];

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  measure: Measure;
  lift_key: string | null;
  video_url: string | null;
  cues: string | null;
  active: boolean;
}

export interface Program {
  id: string;
  name: string;
  description: string | null;
  tag: string | null;
  weeks: number;
  archived: boolean;
  updated_at: string;
}

export interface ProgramDay {
  id: string;
  program_id: string;
  week_no: number;
  day_no: number;
  title: string | null;
  notes: string | null;
}

/** Columns shared by program_items and workout_items. */
export interface ItemFields {
  id: string;
  position: number;
  kind: "exercise" | "text";
  exercise_id: string | null;
  block: string;
  slot: number;
  sets: number | null;
  reps: string | null;
  load_type: LoadType;
  percent: number | string | null;
  rpe: number | string | null;
  load_kg: number | string | null;
  tempo: string | null;
  rest_sec: number | null;
  title: string | null;
  notes: string | null;
}

export const ITEM_COLUMNS =
  "id, position, kind, exercise_id, block, slot, sets, reps, load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes";

export interface Workout {
  id: string;
  athlete_id: string | null;
  group_id: string | null;
  assignment_id: string | null;
  overrides_id: string | null;
  workout_date: string;
  position: number;
  title: string;
  notes: string | null;
}

export interface Group {
  id: string;
  name: string;
  archived: boolean;
}

export interface WorkoutLog {
  id: string;
  workout_id: string;
  athlete_id: string;
  workout_date: string;
  completed_at: string | null;
  session_rpe: number | null;
  duration_min: number | null;
  comment: string | null;
  coach_seen_at: string | null;
}

export interface SetLog {
  id: string;
  log_id: string;
  item_id: string;
  set_no: number;
  reps: number | null;
  load_kg: number | string | null;
  value: number | string | null;
  done: boolean;
}

export interface ItemLog {
  id: string;
  log_id: string;
  item_id: string;
  done: boolean;
  comment: string | null;
}

/** Groups items by block letter, keeping order: [["A", [A1, A2]], ["B", [B]]] */
export function byBlock<T extends { block: string; position: number; slot: number }>(
  items: T[],
): [string, T[]][] {
  const sorted = [...items].sort(
    (a, b) => a.position - b.position || a.block.localeCompare(b.block) || a.slot - b.slot,
  );
  const out: [string, T[]][] = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    if (last && last[0] === it.block) last[1].push(it);
    else out.push([it.block, [it]]);
  }
  return out;
}

/** YouTube/Vimeo/any https link only. */
export function cleanVideoUrl(v: string | null): string | null {
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && v.length <= 300 ? u.toString() : null;
  } catch {
    return null;
  }
}
