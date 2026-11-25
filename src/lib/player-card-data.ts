// Loads everything the player card needs for one athlete.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/week";
import { getEntries } from "@/lib/test-data";
import { getStandards, standardFor } from "@/lib/standards-data";
import { OVERVIEW, currentFor } from "@/lib/strength-standards";
import { weeklyStreak } from "@/lib/programming/rewards";
import { playerCard, standardRating, type Card } from "@/lib/player-card";

export async function loadPlayerCard(
  supabase: SupabaseClient,
  athleteId: string,
  profile: { sex?: string | null; weight_class_limit_kg?: number | string | null },
  today: string,
  extra: { pbs: number; sessions: number; viewAsCoach?: boolean },
): Promise<Card> {
  const from = addDays(today, -56);
  const [entries, { data: maxes }, { data: lastBw }, standards, planned, { data: logs }] = await Promise.all([
    getEntries(supabase, athleteId),
    supabase.from("lift_maxes").select("lift_key, e1rm_kg, bodyweight_kg, saved_on, created_at").eq("athlete_id", athleteId),
    supabase.from("weekly_checkins").select("bodyweight_kg").eq("athlete_id", athleteId).not("bodyweight_kg", "is", null).order("week_start", { ascending: false }).limit(1).maybeSingle(),
    getStandards(supabase),
    (extra.viewAsCoach
      ? supabase.rpc("client_workouts", { p_athlete: athleteId, p_from: from, p_to: today })
      : supabase.rpc("my_workouts", { p_from: from, p_to: today })
    ).then((r) => (r.data ?? []) as { id: string; workout_date: string }[]),
    supabase.from("workout_logs").select("workout_id, workout_date").eq("athlete_id", athleteId).gte("workout_date", from).not("completed_at", "is", null),
  ]);
  const bw = lastBw?.bodyweight_kg != null ? Number(lastBw.bodyweight_kg) : null;
  const sex = (profile.sex === "male" || profile.sex === "female" ? profile.sex : null) as "male" | "female" | null;
  const tests = OVERVIEW.map((r) => {
    const st = standardFor(standards, r.testKey, sex, profile.weight_class_limit_kg as never);
    const cur = currentFor(r, entries, (maxes ?? []) as never, bw);
    return { group: r.group, rating: st && cur ? standardRating(cur.value, st) : null };
  });
  const past = planned.filter((w) => w.workout_date <= today);
  const done = new Set((logs ?? []).map((l) => l.workout_id as string));
  const completionPct = past.length >= 4 ? Math.round((past.filter((w) => done.has(w.id)).length / past.length) * 100) : null;
  const streakWeeks = weeklyStreak(today, past.map((w) => ({ id: w.id, date: w.workout_date })), done);
  return playerCard({ tests, completionPct, streakWeeks, pbs: extra.pbs, sessions: extra.sessions });
}
