// Bronze / Silver / Gold testing standards. Pure functions: unit-tested.
import { e1rmFrom, masOf } from "./testing";

export type Sex = "male" | "female";
export type Level = "gold" | "silver" | "bronze" | "below";

export interface Standard {
  test_key: string;
  sex: Sex;
  bronze: number | null;
  silver: number | null;
  gold: number | null;
  source: string | null;
}

export const LEVEL_LABEL: Record<Level, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  below: "Working towards Bronze",
};
export const LEVEL_COLOR: Record<Exclude<Level, "below">, string> = {
  bronze: "#c27a3f",
  silver: "#b8c0cc",
  gold: "#e0b23a",
};

const r = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
const weaker = (v: Record<string, number>) =>
  v.left_cm != null && v.right_cm != null
    ? Math.min(v.left_cm, v.right_cm)
    : null;

/** The number each test's standards are written in. Higher is always better. */
export const STANDARD_METRICS: Record<
  string,
  {
    label: string;
    unit: string;
    dp: number;
    needsBodyweight?: boolean;
    value: (v: Record<string, number>, bw: number | null) => number | null;
  }
> = {
  med_ball_throw: {
    label: "Best throw",
    unit: "m",
    dp: 2,
    value: (v) => v.best_m ?? null,
  },
  broad_jump: {
    label: "Best jump",
    unit: "cm",
    dp: 0,
    value: (v) => v.best_cm ?? null,
  },
  triple_hop: { label: "Weaker leg", unit: "cm", dp: 0, value: weaker },
  lateral_bound: { label: "Weaker leg", unit: "cm", dp: 0, value: weaker },
  trap_bar_3rm: rel(),
  box_squat_3rm: rel(),
  bench_3rm: rel(),
  chin_ups: {
    label: "Clean reps",
    unit: "reps",
    dp: 0,
    value: (v) => v.reps ?? null,
  },
  mas_5min: mas("mas_5min"),
  mas_bike_5min: mas("mas_bike_5min"),
  mas_row_5min: mas("mas_row_5min"),
  mas_ski_5min: mas("mas_ski_5min"),
  wingate_30s: {
    label: "Peak power",
    unit: "W/kg",
    dp: 1,
    needsBodyweight: true,
    value: (v, bw) => (v.peak_w && bw ? r(v.peak_w / bw, 1) : null),
  },
  cmj: {
    label: "Jump height",
    unit: "cm",
    dp: 1,
    value: (v) => v.jump_height_cm ?? null,
  },
  slj: {
    label: "Weaker leg",
    unit: "cm",
    dp: 1,
    value: (v) =>
      v.left_cm != null && v.right_cm != null
        ? Math.min(v.left_cm, v.right_cm)
        : null,
  },
  imtp: {
    label: "Peak force",
    unit: "N/kg",
    dp: 1,
    needsBodyweight: true,
    value: (v, bw) => (v.peak_force_n && bw ? r(v.peak_force_n / bw, 1) : null),
  },
  rj_10_5: { label: "RSI", unit: "", dp: 2, value: (v) => v.rsi ?? null },
};

function rel() {
  return {
    label: "Estimated 1RM ÷ bodyweight",
    unit: "× BW",
    dp: 2,
    needsBodyweight: true,
    value: (v: Record<string, number>, bw: number | null) =>
      v.load_kg && bw ? r(e1rmFrom(v.load_kg, 3) / bw, 2) : null,
  };
}
function mas(key: string) {
  return {
    label: "MAS",
    unit: "m/s",
    dp: 2,
    value: (v: Record<string, number>) => masOf(key, v)?.ms ?? null,
  };
}

export const hasStandards = (s: Standard | null | undefined) =>
  !!s && (s.bronze != null || s.silver != null || s.gold != null);

export function levelOf(value: number, s: Standard): Level {
  if (s.gold != null && value >= s.gold) return "gold";
  if (s.silver != null && value >= s.silver) return "silver";
  if (s.bronze != null && value >= s.bronze) return "bronze";
  return "below";
}

/** The next level up and how far away it is (null at Gold). */
export function nextTarget(
  value: number,
  s: Standard,
): { level: Exclude<Level, "below">; at: number; gap: number } | null {
  for (const level of ["bronze", "silver", "gold"] as const) {
    const at = s[level];
    if (at != null && value < at) return { level, at, gap: at - value };
  }
  return null;
}

export function formatMetric(n: number, testKey: string) {
  const m = STANDARD_METRICS[testKey];
  const s = m ? n.toFixed(m.dp) : String(n);
  return m?.unit ? `${s} ${m.unit}` : s;
}

/** Parse and check one row of the coach's settings form. */
export function validateStandard(i: {
  bronze: string;
  silver: string;
  gold: string;
}) {
  const parse = (x: string) => {
    const t = x.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n > 0 && n < 100000
      ? Math.round(n * 100) / 100
      : NaN;
  };
  const v = {
    bronze: parse(i.bronze),
    silver: parse(i.silver),
    gold: parse(i.gold),
  };
  if ([v.bronze, v.silver, v.gold].some((x) => Number.isNaN(x)))
    return { error: "Use positive numbers" };
  const set = [v.bronze, v.silver, v.gold].filter(
    (x): x is number => x != null,
  );
  for (let k = 1; k < set.length; k++)
    if (set[k] <= set[k - 1]) return { error: "Bronze < Silver < Gold" };
  return { ok: v };
}

/** Value to compare against standards for one test entry. */
export function entryMetric(
  testKey: string,
  e: { values: Record<string, number>; bodyweight_kg: number | string | null },
) {
  const m = STANDARD_METRICS[testKey];
  if (!m) return null;
  const bw = e.bodyweight_kg == null ? null : Number(e.bodyweight_kg);
  return m.value(e.values, bw);
}
