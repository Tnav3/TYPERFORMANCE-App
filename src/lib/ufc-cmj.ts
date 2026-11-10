// UFC Performance Institute CMJ height benchmarks by weight class.
// Source: UFC PI "A Cross-Sectional Performance Analysis and Projection of the
// UFC Athlete", Vol. 2 (2021), Table 11.1. Force-plate CMJ, jump height from
// impulse-momentum. Pure data + functions: unit-tested.
import type { Sex } from "./standards";

export const UFC_TIERS = [
  "World Class",
  "Very Good",
  "Good",
  "Fair",
  "Poor",
  "Very Poor",
  "Bad",
] as const;
export type UfcTier = (typeof UFC_TIERS)[number];

export interface UfcClass {
  code: string;
  name: string;
  sex: Sex;
  limitKg: number;
  /** Lower bound (cm) of World Class … Very Poor. Below the last = Bad. */
  floors: [number, number, number, number, number, number];
}

// Floors as printed: World Class is "> x", the rest are "from–to" ranges.
export const UFC_CMJ: UfcClass[] = [
  {
    code: "FLW",
    name: "Flyweight",
    sex: "male",
    limitKg: 56.7,
    floors: [59.3, 53.5, 49.2, 40.6, 36.3, 30.5],
  },
  {
    code: "BW",
    name: "Bantamweight",
    sex: "male",
    limitKg: 61.2,
    floors: [56.5, 52.8, 50.1, 44.5, 41.8, 38.1],
  },
  {
    code: "FTW",
    name: "Featherweight",
    sex: "male",
    limitKg: 65.8,
    floors: [60.9, 56.6, 53.3, 46.9, 43.6, 39.3],
  },
  {
    code: "LW",
    name: "Lightweight",
    sex: "male",
    limitKg: 70.3,
    floors: [58.2, 53.8, 50.5, 43.9, 40.6, 36.2],
  },
  {
    code: "WW",
    name: "Welterweight",
    sex: "male",
    limitKg: 77.1,
    floors: [59.9, 55.4, 52.1, 45.3, 42.0, 37.5],
  },
  {
    code: "MW",
    name: "Middleweight",
    sex: "male",
    limitKg: 83.9,
    floors: [60.3, 55.7, 52.2, 45.2, 41.7, 37.1],
  },
  {
    code: "LHW",
    name: "Light Heavyweight",
    sex: "male",
    limitKg: 93.0,
    floors: [65.7, 60.7, 56.9, 49.3, 45.5, 40.5],
  },
  {
    code: "HW",
    name: "Heavyweight",
    sex: "male",
    limitKg: 120.2,
    floors: [63.7, 56.3, 50.7, 39.5, 33.9, 26.5],
  },
  {
    code: "WSW",
    name: "Strawweight",
    sex: "female",
    limitKg: 52.2,
    floors: [47.5, 44.3, 41.9, 37.1, 34.7, 31.5],
  },
  {
    code: "WFLW",
    name: "Flyweight",
    sex: "female",
    limitKg: 56.7,
    floors: [44.2, 41.2, 38.9, 34.3, 32.0, 29.0],
  },
  {
    code: "WBW",
    name: "Bantamweight",
    sex: "female",
    limitKg: 61.2,
    floors: [46.6, 43.4, 41.0, 36.2, 33.8, 30.6],
  },
  {
    code: "WFTW",
    name: "Featherweight",
    sex: "female",
    limitKg: 65.8,
    floors: [52.7, 49.5, 47.1, 42.3, 39.9, 36.7],
  },
];

export const UFC_CMJ_SOURCE =
  "UFC Performance Institute, Cross-Sectional Performance Analysis Vol. 2 (2021), Table 11.1. Force-plate CMJ.";

export const ufcClassesFor = (sex: Sex) => UFC_CMJ.filter((c) => c.sex === sex);

/**
 * The UFC division an athlete's own weight-class limit sits in: the lightest
 * division whose limit is at or above theirs (e.g. a 75 kg boxer → Welterweight).
 * Heavier than every division → the heaviest one.
 */
export function ufcClassForLimit(
  sex: Sex,
  limitKg: number | null,
): UfcClass | null {
  if (limitKg == null || !Number.isFinite(limitKg)) return null;
  const list = ufcClassesFor(sex);
  return list.find((c) => limitKg <= c.limitKg + 0.05) ?? list[list.length - 1];
}

export const ufcClassByCode = (code: string | null | undefined) =>
  UFC_CMJ.find((c) => c.code === code) ?? null;

export function ufcTier(cm: number, c: UfcClass): UfcTier {
  const i = c.floors.findIndex((f) => cm >= f);
  return i === -1 ? "Bad" : UFC_TIERS[i];
}

/** Next tier up and the cm needed (null at World Class). */
export function ufcNext(
  cm: number,
  c: UfcClass,
): { tier: UfcTier; at: number; gap: number } | null {
  for (let i = c.floors.length - 1; i >= 0; i--) {
    if (cm < c.floors[i])
      return {
        tier: UFC_TIERS[i],
        at: c.floors[i],
        gap: Math.round((c.floors[i] - cm) * 10) / 10,
      };
  }
  return null;
}
