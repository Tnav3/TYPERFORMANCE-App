// Exercise history and personal bests from logged sets. Pure, unit-tested.
import { e1rm } from "@/lib/prescription";

export interface LoggedSet {
  date: string;
  reps: number | null;
  kg: number | null;
  value: number | null;
}

export interface SessionSummary {
  date: string;
  sets: LoggedSet[];
  bestE1rm: number | null;
  topSet: { reps: number; kg: number } | null;
  volume: number; // kg × reps
  bestValue: number | null; // time / distance / calories
}

export function sessions(sets: LoggedSet[]): SessionSummary[] {
  const by = new Map<string, LoggedSet[]>();
  for (const s of sets) by.set(s.date, [...(by.get(s.date) ?? []), s]);
  return [...by.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => {
      let best: number | null = null;
      let top: { reps: number; kg: number } | null = null;
      let volume = 0;
      let bestValue: number | null = null;
      for (const s of list) {
        if (s.kg != null && s.reps) volume += s.kg * s.reps;
        if (s.value != null) bestValue = Math.max(bestValue ?? 0, s.value);
        if (s.kg && s.kg > 0 && s.reps && s.reps >= 1 && s.reps <= 12) {
          const e = e1rm(s.kg, s.reps);
          if (best === null || e > best) {
            best = e;
            top = { reps: s.reps, kg: s.kg };
          }
        }
      }
      return { date, sets: list, bestE1rm: best, topSet: top, volume: Math.round(volume), bestValue };
    });
}

/** Heaviest load lifted for each rep count 1–12 (rep PRs), with the date. */
export function repPRs(sets: LoggedSet[]) {
  const best = new Map<number, { kg: number; date: string }>();
  for (const s of sets) {
    if (!s.kg || !s.reps || s.reps < 1 || s.reps > 12) continue;
    const cur = best.get(s.reps);
    if (!cur || s.kg > cur.kg || (s.kg === cur.kg && s.date < cur.date)) best.set(s.reps, { kg: s.kg, date: s.date });
  }
  return [...best.entries()].sort((a, b) => a[0] - b[0]).map(([reps, v]) => ({ reps, ...v }));
}

/**
 * New e1RM personal bests set on or after `since`: the session's best beat
 * everything logged before it. Returns the newest PB per exercise.
 */
export function newPBs(
  rows: (LoggedSet & { key: string })[],
  since: string,
): { key: string; date: string; e1rm: number; previous: number; reps: number; kg: number }[] {
  const byKey = new Map<string, (LoggedSet & { key: string })[]>();
  for (const r of rows) byKey.set(r.key, [...(byKey.get(r.key) ?? []), r]);
  const out: { key: string; date: string; e1rm: number; previous: number; reps: number; kg: number }[] = [];
  for (const [key, list] of byKey) {
    const ss = sessions(list).reverse(); // oldest first
    let bestSoFar = 0;
    let latest: (typeof out)[number] | null = null;
    for (const s of ss) {
      if (s.bestE1rm == null) continue;
      if (s.bestE1rm > bestSoFar) {
        if (bestSoFar > 0 && s.date >= since)
          latest = { key, date: s.date, e1rm: s.bestE1rm, previous: bestSoFar, reps: s.topSet!.reps, kg: s.topSet!.kg };
        bestSoFar = s.bestE1rm;
      }
    }
    if (latest) out.push(latest);
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** 7-day rolling average for a daily series (newest last). */
export function rollingAverage(points: { date: string; kg: number }[], days = 7) {
  return points.map((p, i) => {
    const from = new Date(`${p.date}T00:00:00Z`).getTime() - (days - 1) * 86400000;
    const win = points.slice(0, i + 1).filter((q) => new Date(`${q.date}T00:00:00Z`).getTime() >= from);
    return { date: p.date, avg: Math.round((win.reduce((a, q) => a + q.kg, 0) / win.length) * 10) / 10 };
  });
}
