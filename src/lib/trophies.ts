// Trophy cabinet: every badge track, what's earned, and progress to the next one. Pure, unit-tested.
import { PB_MILESTONES, STREAK_MILESTONES, WORKOUT_MILESTONES } from "@/lib/programming/rewards";
import { HABIT_STREAK_BADGES } from "@/lib/programming/habits";

export const FIGHT_MILESTONES = [1, 5, 10, 25];
export const WIN_MILESTONES = [1, 5, 10, 25];

export interface Track {
  key: string;
  title: string;
  steps: { key: string; label: string; at: number }[];
  progress?: number; // current count when we can compute it
  unit: string;
}

export function tracks(t: { workouts: number; pbs: number; fights: number; wins: number }): Track[] {
  return [
    { key: "workouts", title: "Sessions", unit: "workouts", progress: t.workouts, steps: WORKOUT_MILESTONES.map((m) => ({ key: `workouts_${m}`, label: String(m), at: m })) },
    { key: "streak", title: "Weekly streak", unit: "weeks", steps: STREAK_MILESTONES.map((m) => ({ key: `streak_${m}`, label: `${m}w`, at: m })) },
    { key: "pbs", title: "Personal bests", unit: "PBs", progress: t.pbs, steps: PB_MILESTONES.map((m) => ({ key: `pbs_${m}`, label: String(m), at: m })) },
    { key: "habits", title: "Habit streak", unit: "days", steps: HABIT_STREAK_BADGES.map((m) => ({ key: `habit_streak_${m}`, label: `${m}d`, at: m })) },
    { key: "perfect", title: "Perfect days", unit: "days", steps: [3, 7, 30].map((m) => ({ key: `perfect_${m}`, label: `${m}d`, at: m })) },
    { key: "fights", title: "Fights", unit: "fights", progress: t.fights, steps: FIGHT_MILESTONES.map((m) => ({ key: `fights_${m}`, label: String(m), at: m })) },
    { key: "wins", title: "Wins", unit: "wins", progress: t.wins, steps: WIN_MILESTONES.map((m) => ({ key: `wins_${m}`, label: String(m), at: m })) },
  ];
}

/** Fight badges due now (caller filters out ones already held). */
export function fightBadges(fights: number, wins: number) {
  return [
    ...FIGHT_MILESTONES.filter((m) => fights >= m).map((m) => ({ key: `fights_${m}`, title: m === 1 ? "First fight logged" : `${m} fights` })),
    ...WIN_MILESTONES.filter((m) => wins >= m).map((m) => ({ key: `wins_${m}`, title: m === 1 ? "First win" : `${m} wins` })),
  ];
}

export interface TrackView {
  track: Track;
  earned: number;
  next: { label: string; at: number; have: number | null; pct: number | null } | null;
}

export function cabinet(t: Track[], held: Set<string>): { views: TrackView[]; earned: number; total: number } {
  const views = t.map((track) => {
    const earned = track.steps.filter((s) => held.has(s.key)).length;
    const nx = track.steps.find((s) => !held.has(s.key));
    const have = track.progress ?? null;
    return {
      track,
      earned,
      next: nx ? { label: nx.label, at: nx.at, have, pct: have == null ? null : Math.min(100, Math.round((have / nx.at) * 100)) } : null,
    };
  });
  return { views, earned: views.reduce((a, v) => a + v.earned, 0), total: t.reduce((a, x) => a + x.steps.length, 0) };
}
