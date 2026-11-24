// Readiness score and reward badges. Pure functions (unit-tested).
import { addDays, mondayOf } from "@/lib/week";

export interface ReadinessAnswers {
  sleep: number;
  energy: number;
  soreness: number;
  stress: number;
  motivation: number;
}

/** Same formula as the database: 0–100, higher = more ready. */
export function readinessScore(a: ReadinessAnswers): number {
  return Math.round(((a.sleep + a.energy + (6 - a.soreness) + (6 - a.stress) + a.motivation - 5) * 100) / 20);
}

export function readinessTone(score: number): "ok" | "warn" | "brand" {
  return score >= 70 ? "ok" : score >= 50 ? "warn" : "brand";
}

export function readinessAdvice(score: number): string {
  if (score >= 70) return "You're good to go. Train as written.";
  if (score >= 50) return "A bit flat today. Warm up well and stay at the lower end of your loads and RPE.";
  return "Low readiness. Keep loads at the bottom of the range and drop a set if it feels heavy. Your coach can see this.";
}

export const WORKOUT_MILESTONES = [1, 10, 25, 50, 100, 150, 200, 300, 500];
export const STREAK_MILESTONES = [2, 4, 8, 12, 26, 52];
export const PB_MILESTONES = [1, 10, 25, 50, 100];

export interface Badge {
  key: string;
  title: string;
  detail: string;
}

/** Badges reached at these totals (the caller filters out ones already earned). */
export function badgesFor(totals: { workouts: number; streakWeeks: number; pbs: number }): Badge[] {
  const out: Badge[] = [];
  for (const m of WORKOUT_MILESTONES)
    if (totals.workouts >= m)
      out.push({ key: `workouts_${m}`, title: m === 1 ? "First workout!" : `${m} workouts`, detail: m === 1 ? "The hardest one is done." : `${m} sessions logged. Consistency wins.` });
  for (const m of STREAK_MILESTONES)
    if (totals.streakWeeks >= m)
      out.push({ key: `streak_${m}`, title: `${m}-week streak`, detail: `Every planned session done, ${m} weeks running.` });
  for (const m of PB_MILESTONES)
    if (totals.pbs >= m)
      out.push({ key: `pbs_${m}`, title: m === 1 ? "First PB" : `${m} PBs`, detail: m === 1 ? "Your first personal best in the app." : `${m} personal bests and counting.` });
  return out;
}

/**
 * Consecutive complete weeks ending with the most recent finished week (or the
 * current week, if it's already complete). A week counts when every workout
 * scheduled that week was completed and at least one was scheduled.
 */
export function weeklyStreak(
  today: string,
  scheduled: { date: string; id: string }[],
  completedIds: Set<string>,
): number {
  const byWeek = new Map<string, { total: number; done: number }>();
  for (const w of scheduled) {
    const k = mondayOf(w.date);
    const cur = byWeek.get(k) ?? { total: 0, done: 0 };
    cur.total++;
    if (completedIds.has(w.id)) cur.done++;
    byWeek.set(k, cur);
  }
  const complete = (k: string) => {
    const w = byWeek.get(k);
    return !!w && w.total > 0 && w.done >= w.total;
  };
  let week = mondayOf(today);
  if (!complete(week)) week = addDays(week, -7); // this week still in progress
  let n = 0;
  while (complete(week)) {
    n++;
    week = addDays(week, -7);
  }
  return n;
}
