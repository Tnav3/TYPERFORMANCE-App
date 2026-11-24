// Per-client widgets for the coach (and the client's home trend card). Pure: unit-tested.
import { e1rm } from "@/lib/prescription";
import { addDays, mondayOf } from "@/lib/week";
import type { LoggedSet } from "./history";

export type WidgetKey = "volume" | "strength" | "bodyweight" | "compliance" | "readiness" | "sessions";
export const WIDGETS: [WidgetKey, string, string][] = [
  ["volume", "Training volume", "kg lifted per week"],
  ["strength", "Strength", "best estimated 1RM per week, main lift"],
  ["bodyweight", "Bodyweight", "weigh-ins"],
  ["compliance", "Compliance", "% of planned sessions done"],
  ["readiness", "Readiness", "daily score before training"],
  ["sessions", "Sessions", "workouts completed per week"],
];
export const WIDGET_KEYS = WIDGETS.map((w) => w[0]);
export type HomeTrend = "strength" | "bodyweight" | "volume" | "off";

export function defaultWidgets(p: { fighter: boolean; bodyweight: boolean }): WidgetKey[] {
  return p.fighter ? ["volume", "strength", "readiness", "compliance"] : p.bodyweight ? ["bodyweight", "compliance", "volume", "sessions"] : ["volume", "compliance", "sessions", "strength"];
}
export function defaultHomeTrend(p: { fighter: boolean; bodyweight: boolean }): HomeTrend {
  return p.fighter ? "strength" : p.bodyweight ? "bodyweight" : "volume";
}

/** The last n Mondays, oldest first, ending with this week. */
export function lastWeeks(today: string, n = 8): string[] {
  const m = mondayOf(today);
  return Array.from({ length: n }, (_, i) => addDays(m, -7 * (n - 1 - i)));
}

export interface Point {
  label: string; // week start or date
  value: number | null;
}

export function weeklyVolume(sets: LoggedSet[], weeks: string[]): Point[] {
  return weeks.map((w) => {
    const end = addDays(w, 6);
    const v = sets.filter((s) => s.date >= w && s.date <= end && s.kg != null && s.reps).reduce((t, s) => t + s.kg! * s.reps!, 0);
    return { label: w, value: Math.round(v) };
  });
}

/** The exercise with the most loaded sets is treated as the main lift. */
export function strengthTrend(sets: (LoggedSet & { key: string })[], weeks: string[]): { key: string | null; points: Point[] } {
  const counts = new Map<string, number>();
  for (const s of sets) if (s.kg && s.kg > 0 && s.reps && s.reps <= 12 && s.date >= weeks[0]) counts.set(s.key, (counts.get(s.key) ?? 0) + 1);
  const key = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (!key) return { key: null, points: weeks.map((w) => ({ label: w, value: null })) };
  return {
    key,
    points: weeks.map((w) => {
      const end = addDays(w, 6);
      let best: number | null = null;
      for (const s of sets)
        if (s.key === key && s.date >= w && s.date <= end && s.kg && s.kg > 0 && s.reps && s.reps <= 12) best = Math.max(best ?? 0, e1rm(s.kg, s.reps));
      return { label: w, value: best };
    }),
  };
}

export function weeklyCompliance(planned: string[], completed: string[], weeks: string[]): Point[] {
  return weeks.map((w) => {
    const end = addDays(w, 6);
    const p = planned.filter((d) => d >= w && d <= end).length;
    const c = completed.filter((d) => d >= w && d <= end).length;
    return { label: w, value: p ? Math.round((Math.min(c, p) / p) * 100) : null };
  });
}

export function weeklyCount(dates: string[], weeks: string[]): Point[] {
  return weeks.map((w) => ({ label: w, value: dates.filter((d) => d >= w && d <= addDays(w, 6)).length }));
}

/** Latest value vs the first value in the window: "+7.5 kg", "-2.1%" etc. */
export function change(points: Point[]): { latest: number | null; diff: number | null; pct: number | null } {
  const vals = points.filter((p) => p.value != null) as { label: string; value: number }[];
  if (!vals.length) return { latest: null, diff: null, pct: null };
  const first = vals[0].value;
  const latest = vals[vals.length - 1].value;
  return {
    latest,
    diff: vals.length > 1 ? Math.round((latest - first) * 10) / 10 : null,
    pct: vals.length > 1 && first ? Math.round(((latest - first) / first) * 1000) / 10 : null,
  };
}

/** One plain sentence for the client's trend card, e.g. "Back Squat up 7.5 kg in 6 weeks". */
export function trendMessage(title: string, kind: "bars" | "line", points: Point[]): string | null {
  const vals = points.map((p, i) => ({ i, v: p.value })).filter((x): x is { i: number; v: number } => x.v != null && (kind === "line" || x.v > 0));
  if (vals.length < 2) return null;
  if (kind === "bars") {
    const [a, b] = points.slice(-3, -1).map((p) => p.value ?? 0);
    if (!a || !b) return null;
    const pct = Math.round(((b - a) / a) * 100);
    return pct === 0 ? `${title} steady on the week before` : `${title} ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% on the week before`;
  }
  const first = vals[0];
  const last = vals[vals.length - 1];
  const diff = Math.round((last.v - first.v) * 10) / 10;
  const weeks = Math.max(1, last.i - first.i);
  const span = `in ${weeks} week${weeks === 1 ? "" : "s"}`;
  return diff === 0 ? `${title} holding steady` : `${title} ${diff > 0 ? "up" : "down"} ${Math.abs(diff)} kg ${span}`;
}
