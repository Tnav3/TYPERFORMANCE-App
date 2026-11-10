// Strength Standards overview: one row per movement, using the latest result
// from either Testing or the 1RM Calculator. Pure: unit-tested.
import { entryMetric } from "./standards";

/** Movements on the overview, in display order. */
export type OverviewGroup = "strength" | "power";

export const GROUPS: { key: OverviewGroup; title: string; intro: string }[] = [
  {
    key: "strength",
    title: "Strength",
    intro:
      "How much you can lift for your size. Lifts are your estimated 1RM divided by your bodyweight (× BW), from your latest test or a max saved in the 1RM Calculator. Chin-ups are strict reps.",
  },
  {
    key: "power",
    title: "Power",
    intro:
      "How explosively you can jump. Broad jump, triple hop and lateral bound are in metres; the countermovement jump is in centimetres. Single-leg jumps count your weaker leg, so closing the gap between legs lifts your score.",
  },
];

export const OVERVIEW: {
  testKey: string;
  name: string;
  group: OverviewGroup;
  lifts?: string[];
}[] = [
  {
    testKey: "trap_bar_3rm",
    group: "strength",
    name: "Deadlift (Trap Bar or Barbell)",
    lifts: ["trap_bar_dl", "deadlift"],
  },
  {
    testKey: "box_squat_3rm",
    group: "strength",
    name: "Barbell Squat",
    lifts: ["back_squat", "box_squat"],
  },
  {
    testKey: "bench_3rm",
    name: "Bench Press",
    group: "strength",
    lifts: ["bench"],
  },
  { testKey: "chin_ups", name: "Chin-Ups", group: "strength" },
  { testKey: "broad_jump", name: "Broad Jump", group: "power" },
  { testKey: "triple_hop", name: "Triple Hop", group: "power" },
  { testKey: "lateral_bound", name: "Lateral Bound", group: "power" },
  { testKey: "cmj", name: "Countermovement Jump", group: "power" },
];

export interface EntryLike {
  test_key: string;
  tested_on: string;
  created_at: string;
  values: Record<string, number>;
  bodyweight_kg: number | string | null;
}
export interface LiftMaxLike {
  lift_key: string;
  e1rm_kg: number | string;
  bodyweight_kg: number | string | null;
  saved_on: string;
  created_at: string;
}

export interface Current {
  value: number;
  values?: Record<string, number>;
  on: string;
  from: "test" | "1rm";
}

const later = (a: { on: string; at: string }, b: { on: string; at: string }) =>
  a.on > b.on || (a.on === b.on && a.at > b.at);

/**
 * Latest comparable value for one movement. Lifts: e1RM ÷ bodyweight from a
 * 3RM test or a saved 1RM Calculator max, whichever is newer. A saved max
 * with no bodyweight uses `fallbackBw` (latest check-in); none → skipped.
 */
export function currentFor(
  row: (typeof OVERVIEW)[number],
  entries: EntryLike[],
  maxes: LiftMaxLike[],
  fallbackBw: number | null,
): Current | null {
  let best: (Current & { at: string }) | null = null;
  for (const e of entries) {
    if (e.test_key !== row.testKey) continue;
    const v = entryMetric(row.testKey, e);
    if (v == null) continue;
    const c = {
      value: v,
      values: e.values,
      on: e.tested_on,
      at: e.created_at,
      from: "test" as const,
    };
    if (!best || later({ on: c.on, at: c.at }, { on: best.on, at: best.at }))
      best = c;
  }
  for (const m of maxes) {
    if (!row.lifts?.includes(m.lift_key)) continue;
    const bw = m.bodyweight_kg != null ? Number(m.bodyweight_kg) : fallbackBw;
    if (!bw) continue;
    const v = Math.round((Number(m.e1rm_kg) / bw) * 100) / 100;
    const c = {
      value: v,
      on: m.saved_on,
      at: m.created_at,
      from: "1rm" as const,
    };
    if (!best || later({ on: c.on, at: c.at }, { on: best.on, at: best.at }))
      best = c;
  }
  if (!best) return null;
  const { value, values, on, from } = best as Current & { at: string };
  return values ? { value, values, on, from } : { value, on, from };
}
