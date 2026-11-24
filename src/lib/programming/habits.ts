// Habit gamification: streaks, perfect days, weekly score, badges. Pure (unit-tested).
import { addDays, mondayOf } from "@/lib/week";

/** Consecutive days ticked, ending today (or yesterday if today isn't ticked yet). */
export function streak(days: Set<string>, today: string): number {
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export interface HabitStats {
  perHabit: Map<string, number>; // habit id → current streak
  perfectToday: boolean;
  perfectStreak: number; // consecutive days with every habit ticked
  weekScore: number; // % of possible ticks this Mon–Sun so far
  perfectDaysThisWeek: number;
}

export function habitStats(
  habitIds: string[],
  logs: { habit_id: string; day: string }[],
  today: string,
): HabitStats {
  const byHabit = new Map<string, Set<string>>(habitIds.map((h) => [h, new Set()]));
  for (const l of logs) byHabit.get(l.habit_id)?.add(l.day);
  const perHabit = new Map(habitIds.map((h) => [h, streak(byHabit.get(h)!, today)]));
  const perfect = (d: string) => habitIds.length > 0 && habitIds.every((h) => byHabit.get(h)!.has(d));
  const perfectDays = new Set<string>();
  for (const l of logs) if (perfect(l.day)) perfectDays.add(l.day);
  const mon = mondayOf(today);
  const daysSoFar = Math.round((Date.parse(today) - Date.parse(mon)) / 86400000) + 1;
  let ticks = 0;
  for (const set of byHabit.values()) for (const d of set) if (d >= mon && d <= today) ticks++;
  const possible = habitIds.length * daysSoFar;
  return {
    perHabit,
    perfectToday: perfect(today),
    perfectStreak: streak(perfectDays, today),
    weekScore: possible ? Math.round((ticks / possible) * 100) : 0,
    perfectDaysThisWeek: [...perfectDays].filter((d) => d >= mon && d <= today).length,
  };
}

export const HABIT_STREAK_BADGES = [7, 30, 100];

/** Badge keys earned for the current stats (caller removes ones already held). */
export function habitBadges(s: HabitStats): { key: string; title: string; detail: string }[] {
  const best = Math.max(0, ...s.perHabit.values());
  const out: { key: string; title: string; detail: string }[] = [];
  for (const m of HABIT_STREAK_BADGES)
    if (best >= m) out.push({ key: `habit_streak_${m}`, title: `${m}-day habit streak`, detail: `One habit, ${m} days straight.` });
  for (const m of [3, 7, 30])
    if (s.perfectStreak >= m) out.push({ key: `perfect_${m}`, title: `${m} perfect days`, detail: `Every habit ticked, ${m} days running.` });
  return out;
}
