import type { LoadType } from "@/lib/prescription";

// Movement patterns (migration 056). Keep in step with exercises_category_check / exercises_subcategory_check.
export const EXERCISE_CATEGORIES = [
  ["knee", "Knee dominant"],
  ["hip", "Hip dominant"],
  ["h_press", "Horizontal press"],
  ["v_press", "Vertical press"],
  ["h_pull", "Horizontal pull"],
  ["v_pull", "Vertical pull"],
  ["ballistic", "Ballistics"],
  ["core", "Core"],
  ["accessory", "Accessory"],
  ["cond_mob", "Conditioning & mobility"],
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number][0];

export const SUBCATEGORIES: Record<ExerciseCategory, [string, string][]> = {
  knee: [["squat", "Squat"], ["lunge", "Lunge / split squat"], ["step_up", "Step-up"], ["single_leg", "Single-leg"]],
  hip: [["hinge", "Hinge / deadlift"], ["thrust", "Bridge / thrust"], ["curl", "Hamstring curl"], ["single_leg", "Single-leg"]],
  h_press: [["barbell", "Barbell"], ["dumbbell", "Dumbbell & cable"], ["push_up", "Push-up & dip"]],
  v_press: [["barbell", "Barbell"], ["dumbbell", "Dumbbell & kettlebell"], ["landmine", "Landmine"]],
  h_pull: [["rows", "Rows"]],
  v_pull: [["pull_up", "Pull-up / chin-up"], ["pulldown", "Pulldown"]],
  ballistic: [["jumps", "Jumps"], ["bounds", "Bounds & hops"], ["throw_rot", "Throws: rotation"], ["throw_oh", "Throws: overhead & slam"], ["throw_chest", "Throws: chest"], ["olympic", "Olympic lifts"], ["upper", "Upper-body plyo"]],
  core: [["anti_ext", "Anti-extension"], ["anti_rot", "Anti-rotation"], ["rotation", "Rotation"], ["lateral", "Lateral"], ["flexion", "Flexion"]],
  accessory: [["arms", "Arms"], ["shoulders", "Shoulders"], ["calves", "Calves & feet"], ["neck", "Neck"], ["grip", "Grip & carries"], ["hips", "Hips & adductors"]],
  cond_mob: [["conditioning", "Conditioning"], ["stretch", "Stretch"], ["soft_tissue", "Soft tissue"], ["activation", "Activation & mobility"]],
};
export const isCategory = (v: string): v is ExerciseCategory => EXERCISE_CATEGORIES.some(([c]) => c === v);
export const subLabel = (cat: string, sub: string | null | undefined) =>
  (sub && isCategory(cat) && SUBCATEGORIES[cat].find(([k]) => k === sub)?.[1]) || null;

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
  subcategory: string | null;
  equipment?: string[];
  measure: Measure;
  lift_key: string | null;
  video_url: string | null;
  cues: string | null;
  active: boolean;
  fields?: string[] | null;
  weight_unit?: "kg" | "lb";
  distance_unit?: "m" | "km" | "mi" | "yd";
  speed_unit?: "ms" | "kmh" | "mph";
  default_sets?: number | null;
  default_reps?: string | null;
  default_load_type?: string | null;
  default_load_value?: number | string | null;
  default_rest_sec?: number | null;
  tags?: string[];
  source?: string | null;
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
  block_title?: string | null;
  velocity?: number | string | null;
  fields?: string[] | null;
  set_plan?: SetTarget[] | null;
}

export const ITEM_COLUMNS =
  "id, position, kind, exercise_id, block, slot, sets, reps, load_type, percent, rpe, load_kg, tempo, rest_sec, title, notes, block_title, velocity, fields, set_plan";

/** One planned set: reps text plus optional % (p), RPE (e) or kg (k). */
export interface SetTarget {
  r: string;
  p?: number;
  e?: number;
  k?: number;
}

/** The block's label: first non-empty block_title among its items. */
export const blockTitle = (items: { block_title?: string | null }[]) =>
  items.find((i) => i.block_title?.trim())?.block_title?.trim() ?? null;

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
  /** Set when the client made it themselves */
  created_by?: string | null;
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
  metrics?: Record<string, number | null> | null;
  done: boolean;
}

export interface ItemLog {
  id: string;
  log_id: string;
  item_id: string;
  done: boolean;
  comment: string | null;
  swap_exercise_id?: string | null;
  swap_reason?: SwapReason | null;
  swap_note?: string | null;
}
export const SWAP_REASONS = [
  ["equipment", "No equipment / taken"],
  ["pain", "Pain or niggle"],
  ["too_hard", "Too hard right now"],
  ["too_easy", "Too easy"],
  ["preference", "Prefer another"],
  ["other", "Other"],
] as const;
export type SwapReason = (typeof SWAP_REASONS)[number][0];

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
