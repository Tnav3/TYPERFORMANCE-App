// Fight camp mode: phase of camp + weight-make tracking from next_fight_date,
// weight_class_limit_kg and logged bodyweights. Pure, unit-tested.
// Weight thresholds follow common sports-dietetics guidance (chronic loss about
// 0.5–1% BW/week; acute cut in fight week kept to about 5% or less). They're flags
// for a conversation with a dietitian, not a cutting protocol.

export type CampPhase = "off" | "general" | "specific" | "peak" | "fight_week" | "fight_day";
export const PHASES: Record<Exclude<CampPhase, "off">, { label: string; focus: string }> = {
  general: { label: "General prep", focus: "Build the engine and strength. Most volume of the camp." },
  specific: { label: "Fight-specific prep", focus: "Power, repeat efforts and rounds that look like the fight." },
  peak: { label: "Peak and taper", focus: "Volume drops, intensity stays. Fresh, fast and sharp." },
  fight_week: { label: "Fight week", focus: "Short sharp sessions, sleep, and the weight plan with your dietitian." },
  fight_day: { label: "Fight day", focus: "Trust the work. Fuel, warm up, go." },
};

const dayMs = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / dayMs);

export interface CampInput {
  fight: string | null;
  today: string;
  campWeeks?: number; // default 10
  limitKg: number | null;
  weights: { date: string; kg: number }[]; // any order
}
export interface CampStatus {
  phase: CampPhase;
  daysOut: number;
  week: number; // week of camp, 1-based
  totalWeeks: number;
  label: string;
  focus: string;
  weight: null | {
    latest: number;
    latestDate: string;
    overKg: number;
    overPct: number;
    perWeekNeeded: number | null; // kg/week to be within 5% by fight week, null if already there
    trendPerWeek: number | null; // from logs in the last 21 days
    onTrack: boolean | null;
  };
  flags: string[];
}

function slope(pts: { date: string; kg: number }[]): number | null {
  if (pts.length < 3) return null;
  const x0 = pts[0].date;
  const xs = pts.map((p) => days(x0, p.date));
  const span = xs[xs.length - 1] - xs[0];
  if (span < 7) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = pts.reduce((a, p) => a + p.kg, 0) / pts.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (pts[i].kg - my); den += (x - mx) ** 2; });
  return den ? Math.round((num / den) * 7 * 100) / 100 : null;
}

export function campStatus(i: CampInput): CampStatus | null {
  if (!i.fight) return null;
  const totalWeeks = i.campWeeks ?? 10;
  const out = days(i.today, i.fight);
  if (out < 0 || out > totalWeeks * 7) return null;
  const phase: CampPhase = out === 0 ? "fight_day" : out < 7 ? "fight_week" : out <= 21 ? "peak" : out <= Math.min(56, totalWeeks * 7 - 14) ? "specific" : "general";
  const week = Math.min(totalWeeks, Math.max(1, totalWeeks - Math.ceil(out / 7) + 1));
  const flags: string[] = [];
  let weight: CampStatus["weight"] = null;
  const sorted = [...i.weights].filter((w) => Number.isFinite(w.kg) && w.kg > 0 && w.date <= i.today).sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  if (i.limitKg && last) {
    const overKg = Math.round((last.kg - i.limitKg) * 10) / 10;
    const overPct = Math.round((overKg / i.limitKg) * 1000) / 10;
    const weeksToFightWeek = (out - 7) / 7;
    const target = i.limitKg * 1.05;
    const gap = last.kg - target;
    const perWeekNeeded = gap > 0 && weeksToFightWeek > 0 ? Math.round((gap / weeksToFightWeek) * 100) / 100 : null;
    const recent = sorted.filter((w) => days(w.date, i.today) <= 21);
    const trendPerWeek = slope(recent);
    const onTrack = gap <= 0 ? true : perWeekNeeded == null || trendPerWeek == null ? null : -trendPerWeek >= perWeekNeeded * 0.8;
    weight = { latest: Math.round(last.kg * 10) / 10, latestDate: last.date, overKg, overPct, perWeekNeeded, trendPerWeek, onTrack };
    if (days(last.date, i.today) > 7) flags.push("No weigh-in this week. Log one so the tracker stays honest.");
    if (gap > 0 && weeksToFightWeek <= 0) flags.push(`${overPct}% over the limit in fight week. Talk to your dietitian today.`);
    else if (perWeekNeeded && perWeekNeeded > last.kg * 0.01) flags.push(`Needs ${perWeekNeeded} kg a week, more than 1% of body weight. Review the plan or the weight class.`);
    if (onTrack === false) flags.push("Behind the weight trend this camp.");
  } else if (!i.limitKg) {
    flags.push("Add a weight class limit to track the weight make.");
  }
  return { phase, daysOut: out, week, totalWeeks, label: PHASES[phase as Exclude<CampPhase, "off">].label, focus: PHASES[phase as Exclude<CampPhase, "off">].focus, weight, flags };
}
