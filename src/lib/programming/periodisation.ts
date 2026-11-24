// Periodisation helpers: phase weeks with load/deload pattern, fight weeks-out.
import { daysBetween } from "@/lib/dates";
import { addDays, mondayOf } from "@/lib/week";

export const EMPHASIS = [
  ["strength", "Strength", "#d31820"],
  ["power", "Power", "#f59e0b"],
  ["hypertrophy", "Hypertrophy", "#a855f7"],
  ["conditioning", "Conditioning", "#22c55e"],
  ["speed", "Speed", "#06b6d4"],
  ["skill", "Skill", "#3b82f6"],
  ["recovery", "Recovery", "#a1a1aa"],
  ["weight_cut", "Weight cut", "#ec4899"],
] as const;
export const EMPHASIS_COLOR = new Map<string, string>(EMPHASIS.map(([k, , c]) => [k, c]));

export const PHASE_TEMPLATES = [
  "GPP",
  "Hypertrophy",
  "Max Strength",
  "Strength-Speed",
  "Power",
  "Peak",
  "Taper",
  "Fight Week",
  "Deload",
  "Off-season",
] as const;

export interface PhaseWeek {
  start: string; // Monday
  index: number; // 1-based within phase
  kind: "load" | "deload";
  rel: number; // relative volume (1 = base)
}

/**
 * Weeks of a phase with a load:deload pattern like "3:1".
 * Load weeks step up 10% each (1.0, 1.1, 1.2…); deload weeks are 60%.
 */
export function phaseWeeks(start: string, end: string, pattern: string): PhaseWeek[] {
  const [l, d] = pattern.split(":").map(Number);
  const cycle = Math.max(1, l + d);
  const out: PhaseWeek[] = [];
  let mon = mondayOf(start);
  let i = 0;
  while (mon <= end && i < 30) {
    const pos = i % cycle;
    const deload = pos >= l;
    out.push({ start: mon, index: i + 1, kind: deload ? "deload" : "load", rel: deload ? 0.6 : Math.round((1 + pos * 0.1) * 100) / 100 });
    mon = addDays(mon, 7);
    i++;
  }
  return out;
}

/** "8 wk out", "Fight week", "Fight day", or null once past. */
export function weeksOut(date: string, fight: string): string | null {
  const d = daysBetween(date, fight);
  if (d < 0) return null;
  if (d === 0) return "Fight day";
  if (d < 7) return "Fight week";
  return `${Math.floor(d / 7)} wk out`;
}

/** Where a date sits on a timeline from..to, as a 0–100 percentage. */
export function pos(date: string, from: string, to: string): number {
  const total = Math.max(1, daysBetween(from, to));
  return Math.min(100, Math.max(0, (daysBetween(from, date) / total) * 100));
}

/** Phase that contains a date, if any. */
export function currentPhase<T extends { start_date: string; end_date: string }>(phases: T[], date: string): T | null {
  return phases.find((p) => p.start_date <= date && date <= p.end_date) ?? null;
}
