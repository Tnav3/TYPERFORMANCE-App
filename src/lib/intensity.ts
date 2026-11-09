// RPE / RIR and heart-rate intensity references. Pure functions: unit-tested.

// ---------------------------------------------------------------------------
// Resistance-training RPE ↔ reps in reserve
// Whole numbers: Zourdos et al. 2016, J Strength Cond Res 30(1):267–275 (Table 1).
// Half steps (9.5 / 8.5 / 7.5 / 6.5): Tuchscherer, Reactive Training Systems.
// ---------------------------------------------------------------------------
export const RIR_SCALE: { rpe: string; rir: string; feel: string }[] = [
  { rpe: "10", rir: "0", feel: "Maximum effort. No more reps." },
  { rpe: "9.5", rir: "0–1", feel: "Maybe 1 more rep." },
  { rpe: "9", rir: "1", feel: "Definitely 1 more rep." },
  { rpe: "8.5", rir: "1–2", feel: "1 more for sure, maybe 2." },
  { rpe: "8", rir: "2", feel: "2 more reps." },
  { rpe: "7.5", rir: "2–3", feel: "2 more for sure, maybe 3." },
  { rpe: "7", rir: "3", feel: "3 more reps." },
  { rpe: "5–6", rir: "4–6", feel: "4–6 more reps." },
  { rpe: "3–4", rir: "—", feel: "Light effort." },
  { rpe: "1–2", rir: "—", feel: "Little to no effort." },
];

// ---------------------------------------------------------------------------
// %1RM for reps × RPE (Tuchscherer / RTS chart).
// The chart depends only on reps + reps-in-reserve ("reps to failure"):
// e.g. 3 reps @ RPE 10 = 1 rep @ RPE 8 = 92.2 %. Published copies agree up to
// 10 reps to failure and differ by ~1 % beyond that, so cells past 10 are left blank.
// ---------------------------------------------------------------------------
const RTS_BY_REPS_TO_FAILURE: Record<number, number> = {
  1: 100, 1.5: 97.8, 2: 95.5, 2.5: 93.9, 3: 92.2, 3.5: 90.7, 4: 89.2, 4.5: 87.8,
  5: 86.3, 5.5: 85.0, 6: 83.7, 6.5: 82.4, 7: 81.1, 7.5: 79.9, 8: 78.6, 8.5: 77.4,
  9: 76.2, 9.5: 75.1, 10: 73.9,
};
export const RPE_COLUMNS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6];
export const REP_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function pctFor(reps: number, rpe: number): number | null {
  if (!Number.isInteger(reps) || reps < 1 || rpe < 6 || rpe > 10 || (rpe * 2) % 1 !== 0) return null;
  return RTS_BY_REPS_TO_FAILURE[reps + (10 - rpe)] ?? null;
}

/** Estimated 1RM from a set done at a given RPE: load ÷ chart %. */
export function e1rmFromRpe(load: number, reps: number, rpe: number): number | null {
  const pct = pctFor(reps, rpe);
  if (pct == null || !(load > 0)) return null;
  return Math.round((load / (pct / 100)) * 2) / 2;
}

export const roundTo2_5 = (kg: number) => Math.round(kg / 2.5) * 2.5;

// ---------------------------------------------------------------------------
// Heart-rate intensity (ACSM; Garber et al. 2011 position stand).
// %HRR, %HRmax and Borg RPE (6–20) ranges for each intensity band.
// ---------------------------------------------------------------------------
export interface HrBand {
  zone: number;
  name: string;
  hrmax: [number, number]; // inclusive % range
  hrr: [number, number];
  borg: string;
}
export const HR_BANDS: HrBand[] = [
  { zone: 1, name: "Very light", hrmax: [0, 56], hrr: [0, 29], borg: "below 9" },
  { zone: 2, name: "Light", hrmax: [57, 63], hrr: [30, 39], borg: "9–11" },
  { zone: 3, name: "Moderate", hrmax: [64, 76], hrr: [40, 59], borg: "12–13" },
  { zone: 4, name: "Vigorous", hrmax: [77, 95], hrr: [60, 89], borg: "14–17" },
  { zone: 5, name: "Near max", hrmax: [96, 100], hrr: [90, 100], borg: "18–20" },
];

/** Tanaka et al. 2001: HRmax = 208 − 0.7 × age. */
export const tanakaHrMax = (age: number) => Math.round(208 - 0.7 * age);

/** bpm for a % using %HRmax, or Karvonen (%HRR) when resting HR is known. */
export function bpmAt(pct: number, hrMax: number, rest?: number | null): number {
  return Math.round(rest != null ? rest + (pct / 100) * (hrMax - rest) : (pct / 100) * hrMax);
}

export function hrZones(hrMax: number, rest?: number | null) {
  const method: "hrr" | "hrmax" = rest != null ? "hrr" : "hrmax";
  return HR_BANDS.map((b) => {
    const [lo, hi] = method === "hrr" ? b.hrr : b.hrmax;
    return {
      ...b,
      pct: [lo, hi] as [number, number],
      bpm: [lo === 0 ? null : bpmAt(lo, hrMax, rest), bpmAt(hi, hrMax, rest)] as [number | null, number],
    };
  });
}

export function validateHr(i: { age?: number | null; hrMax?: number | null; rest?: number | null }) {
  const e: Record<string, string> = {};
  if (i.hrMax != null) {
    if (!(i.hrMax >= 120 && i.hrMax <= 230)) e.hrMax = "Max heart rate between 120 and 230";
  } else if (i.age == null || !(i.age >= 10 && i.age <= 90)) {
    e.age = "Enter an age (10–90) or a measured max heart rate";
  }
  if (i.rest != null && !(i.rest >= 30 && i.rest <= 110)) e.rest = "Resting heart rate between 30 and 110";
  return e;
}
