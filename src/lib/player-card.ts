// Player card: 1–99 ratings that grow as the athlete improves. Pure, unit-tested.
// Strength / Power / Engine come from the Bronze-Silver-Gold standards (so they
// mean the same thing as the Standards page). Consistency and Grit come from training.
import type { Standard } from "./standards";

export type CardStat = "str" | "pwr" | "eng" | "con" | "grt";
export const STAT_LABEL: Record<CardStat, string> = { str: "STR", pwr: "PWR", eng: "ENG", con: "CON", grt: "GRT" };
export const STAT_NAME: Record<CardStat, string> = { str: "Strength", pwr: "Power", eng: "Engine", con: "Consistency", grt: "Grit" };

const clamp = (n: number, lo = 1, hi = 99) => Math.max(lo, Math.min(hi, Math.round(n)));

/** One test result → 1–99. Bronze ≈ 70, Silver ≈ 80, Gold ≈ 90+. Handles lower-is-better standards. */
export function standardRating(value: number, s: Pick<Standard, "bronze" | "silver" | "gold">): number | null {
  let { bronze, silver, gold } = s;
  if (bronze == null && silver == null && gold == null) return null;
  let v = value;
  const lowerBetter = bronze != null && gold != null && gold < bronze;
  if (lowerBetter) {
    v = -v;
    bronze = -bronze!;
    silver = silver == null ? null : -silver;
    gold = -gold!;
  }
  const b = bronze ?? silver ?? gold!;
  const sv = silver ?? (gold != null ? (b + gold) / 2 : b * 1.15);
  const g = gold ?? sv * 1.15;
  if (v >= g) return clamp(90 + ((v - g) / Math.max(1e-9, Math.abs(g - sv))) * 5);
  if (v >= sv) return clamp(80 + ((v - sv) / Math.max(1e-9, g - sv)) * 10);
  if (v >= b) return clamp(70 + ((v - b) / Math.max(1e-9, sv - b)) * 10);
  // below bronze: 40 at zero-ish, 69 just under bronze
  const frac = lowerBetter ? Math.max(0, 1 - (b - v) / Math.abs(b)) : Math.max(0, v / b);
  return clamp(40 + frac * 29, 40, 69);
}

export interface CardInput {
  tests: { group: "strength" | "power" | "conditioning"; rating: number | null }[];
  completionPct: number | null; // last 8 weeks
  streakWeeks: number;
  pbs: number;
  sessions: number;
}

export interface Card {
  stats: Record<CardStat, number | null>;
  overall: number | null;
  tier: "rookie" | "bronze" | "silver" | "gold" | "elite";
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function playerCard(i: CardInput): Card {
  const by = (g: CardInput["tests"][number]["group"]) => {
    const a = avg(i.tests.filter((t) => t.group === g && t.rating != null).map((t) => t.rating!));
    return a == null ? null : clamp(a);
  };
  const con = i.completionPct == null ? null : clamp(40 + i.completionPct * 0.59);
  const grt = i.sessions ? clamp(45 + i.streakWeeks * 3 + Math.min(20, i.pbs) + Math.min(15, i.sessions / 10)) : null;
  const stats: Record<CardStat, number | null> = { str: by("strength"), pwr: by("power"), eng: by("conditioning"), con, grt };
  const have = Object.values(stats).filter((x): x is number => x != null);
  const overall = have.length >= 2 ? clamp(avg(have)!) : null;
  const tier = overall == null ? "rookie" : overall >= 88 ? "elite" : overall >= 80 ? "gold" : overall >= 70 ? "silver" : overall >= 60 ? "bronze" : "rookie";
  return { stats, overall, tier };
}
