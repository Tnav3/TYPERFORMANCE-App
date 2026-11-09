// e1RM & percentage calculator (spec §7). Pure functions: unit-tested.
import { e1rmFrom } from "./testing";

export type LiftKind = "barbell" | "bodyweight" | "olympic" | "jump";
export type VelocityModel = "bench" | "squat" | "deadlift";

export interface Lift {
  key: string;
  name: string;
  category: "squat" | "hinge" | "press" | "pull" | "olympic" | "jump";
  kind: LiftKind;
  per_leg: boolean;
  parent_key: string | null;
  bar_weight_input: boolean;
  velocity_model: VelocityModel | null;
  sort_order: number;
  active: boolean;
}

export const CATEGORY_LABEL: Record<Lift["category"], string> = {
  squat: "Squat / lower",
  hinge: "Hinge",
  press: "Press",
  pull: "Pull",
  olympic: "Olympic",
  jump: "Loaded jumps & throws",
};
export const CATEGORY_ORDER: Lift["category"][] = [
  "squat",
  "hinge",
  "press",
  "pull",
  "olympic",
  "jump",
];

export const MAX_REPS = 10;
export const RELIABLE_REPS = 5;
export const OLYMPIC_MAX_REPS = 3;

export const roundTo2_5 = (kg: number) => Math.round(kg / 2.5) * 2.5;

export interface CalcInput {
  kind: LiftKind;
  load: number; // added load for bodyweight lifts
  reps: number;
  bodyweight?: number | null;
}

export interface CalcResult {
  /** e1RM the percentages are taken from (system mass for bodyweight lifts) */
  e1rm: number;
  /** for bodyweight lifts: best added load = system e1RM − bodyweight */
  addedMax?: number;
  warnings: string[];
}

export function validateCalc(i: CalcInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (i.kind === "jump") e.lift = "Jumps use the parent lift's 1RM";
  if (!Number.isInteger(i.reps) || i.reps < 1 || i.reps > MAX_REPS)
    e.reps = `Reps from 1 to ${MAX_REPS}`;
  if (i.kind === "bodyweight") {
    if (!Number.isFinite(i.load) || i.load < 0 || i.load > 200)
      e.load = "Added weight from 0 to 200 kg";
    if (
      i.bodyweight == null ||
      !Number.isFinite(i.bodyweight) ||
      i.bodyweight < 30 ||
      i.bodyweight > 200
    )
      e.bodyweight = "Bodyweight between 30 and 200 kg";
  } else if (!Number.isFinite(i.load) || i.load <= 0 || i.load > 600) {
    e.load = "Weight from 1 to 600 kg";
  }
  return e;
}

export function calculate(i: CalcInput): CalcResult {
  const warnings: string[] = [];
  if (i.kind === "olympic" && i.reps > OLYMPIC_MAX_REPS)
    warnings.push(
      "Olympic lifts: use a 1–3 rep max. Above 3 reps this is a rough guide only.",
    );
  else if (i.reps > RELIABLE_REPS)
    warnings.push(
      "Most accurate from 1–5 reps. Above 5 reps treat this as a rough guide.",
    );
  if (i.kind === "bodyweight") {
    const bw = i.bodyweight as number;
    const e1rm = e1rmFrom(i.load + bw, i.reps);
    return { e1rm, addedMax: Math.round((e1rm - bw) * 2) / 2, warnings };
  }
  return { e1rm: e1rmFrom(i.load, i.reps), warnings };
}

export const PERCENTS = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
/** Loaded jumps: 10–60 %. The coach prescribes the %; the spec leaves default ranges open. */
export const JUMP_PERCENTS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
/** Smith bench throw typical range (spec §7) */
export const BENCH_THROW_RANGE: [number, number] = [30, 50];

export interface PercentRow {
  pct: number;
  /** total load to put on the bar (kg), nearest 2.5 */
  load: number;
  /** bodyweight lifts: added load (may be ≤ 0 → bodyweight only) */
  added?: number;
  /** jumps with bar_weight_input: plates each side */
  perSide?: number;
  velocity?: number | null;
}

export function percentTable(opts: {
  e1rm: number;
  kind: LiftKind;
  bodyweight?: number | null;
  percents?: number[];
  barWeight?: number | null;
  velocityModel?: VelocityModel | null;
}): PercentRow[] {
  const pcts =
    opts.percents ?? (opts.kind === "jump" ? JUMP_PERCENTS : PERCENTS);
  return pcts.map((pct) => {
    const raw = (opts.e1rm * pct) / 100;
    const row: PercentRow = { pct, load: roundTo2_5(raw) };
    if (opts.kind === "bodyweight" && opts.bodyweight != null) {
      row.added = roundTo2_5(raw - opts.bodyweight);
      row.load = row.added; // what goes on the belt
    }
    if (opts.barWeight != null) {
      row.perSide = Math.max(0, (row.load - opts.barWeight) / 2);
    }
    row.velocity = opts.velocityModel
      ? velocityAt(opts.velocityModel, pct)
      : null;
    return row;
  });
}

// ---------------------------------------------------------------------------
// Bar-speed guide. Group research values, NOT individual targets.
//
// bench (MPV): González-Badillo & Sánchez-Medina's published response letter
//   (Int J Sports Med 2010 data; PMC6260059):
//   MPV = 0.00003233·L² − 0.02022·L + 1.881   (L = %1RM; R² 0.98, SEE 0.06 m/s)
//   The letter typesets the squared term with a minus sign; that version gives
//   −0.46 m/s at 100 % (impossible), while "+" gives ≈0.18 m/s at 1RM, matching
//   the paper's reported 1RM velocity (0.16 ± 0.04 m/s). So "+" is used.
// deadlift (MV): Benavides-Ubric et al. 2020, J Sports Sci Med:
//   %1RM = −80.188·MV + 124.929 (R² 0.913, SEE 5.55 %)  →  MV = (124.929 − L) / 80.188
// squat (MV): Sánchez-Medina et al. 2017 full back squat. Only these values
//   were verifiable: 1RM ≈ 0.32 m/s; ≈0.80 m/s ≈ 70 %; ≈0.67 m/s at 80 %.
//   Everything else is left blank rather than guessed.
// ---------------------------------------------------------------------------
export const VELOCITY_META: Record<
  VelocityModel,
  { measure: "MPV" | "MV"; source: string }
> = {
  bench: {
    measure: "MPV",
    source: "González-Badillo & Sánchez-Medina 2010",
  },
  deadlift: {
    measure: "MV",
    source: "Benavides-Ubric et al. 2020",
  },
  squat: {
    measure: "MV",
    source: "Sánchez-Medina et al. 2017, full back squat",
  },
};

const SQUAT_ANCHORS: Record<number, number> = { 100: 0.32, 80: 0.67, 70: 0.8 };

export function velocityAt(model: VelocityModel, pct: number): number | null {
  if (pct < 30 || pct > 100) return null;
  let v: number | null;
  if (model === "bench") v = 0.00003233 * pct * pct - 0.02022 * pct + 1.881;
  else if (model === "deadlift") v = (124.929 - pct) / 80.188;
  else v = SQUAT_ANCHORS[pct] ?? null;
  return v == null ? null : Math.round(v * 100) / 100;
}

/** Newest saved e1RM per lift. Input rows in any order. */
export function latestMaxes<
  T extends { lift_key: string; created_at: string },
>(rows: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const r of rows) {
    const cur = out[r.lift_key];
    if (!cur || r.created_at > cur.created_at) out[r.lift_key] = r;
  }
  return out;
}

export function groupLifts(lifts: Lift[]) {
  return CATEGORY_ORDER.map((c) => ({
    category: c,
    label: CATEGORY_LABEL[c],
    lifts: lifts
      .filter((l) => l.category === c)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
  })).filter((g) => g.lifts.length > 0);
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 34);
}

/** Capitalise the first letter of every word (incl. after "-" or "("), leave the rest as typed: "paused box squat" → "Paused Box Squat", "RDL" stays "RDL". */
export function titleCase(name: string): string {
  return name.replace(/(^|[\s\-(/])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
}
