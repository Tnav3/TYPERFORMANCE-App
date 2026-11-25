// Loads everything the player card needs for one athlete.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/week";
import { getEntries } from "@/lib/test-data";
import { getStandards, standardFor } from "@/lib/standards-data";
import { OVERVIEW, currentFor } from "@/lib/strength-standards";
import { weeklyStreak } from "@/lib/programming/rewards";
import { playerCard, standardRating, type Card } from "@/lib/player-card";
import { loggedSets } from "@/lib/programming/history-data";
import { pbEvents } from "@/lib/programming/history";

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

export interface CachedCard extends Card {
  seen: number | null; // overall the client last saw in the Trophy cabinet
}

/** Save the card the client is looking at (Trophy cabinet) and mark it seen. */
export async function saveSeenCard(supabase: SupabaseClient, athleteId: string, card: Card, today: string) {
  await supabase
    .from("player_cards")
    .upsert({ athlete_id: athleteId, overall: card.overall, tier: card.tier, stats: card.stats, seen_overall: card.overall, updated_on: today }, { onConflict: "athlete_id" });
}

/** Card for the home strip: cached, recomputed at most once a day. */
export async function homeCard(
  supabase: SupabaseClient,
  athleteId: string,
  profile: { sex?: string | null; weight_class_limit_kg?: number | string | null },
  today: string,
  viewAsCoach = false,
): Promise<CachedCard | null> {
  const { data: row } = await supabase.from("player_cards").select("overall, tier, stats, seen_overall, updated_on").eq("athlete_id", athleteId).maybeSingle();
  if (row && (row.updated_on >= today || viewAsCoach)) return { overall: row.overall, tier: row.tier, stats: row.stats, seen: viewAsCoach ? row.overall : row.seen_overall };
  if (viewAsCoach) return null;
  const [all, { count: sessions }] = await Promise.all([
    loggedSets(supabase, athleteId),
    supabase.from("workout_logs").select("id", { count: "exact", head: true }).eq("athlete_id", athleteId).not("completed_at", "is", null),
  ]);
  const card = await loadPlayerCard(supabase, athleteId, profile, today, { pbs: pbEvents(all).length, sessions: sessions ?? 0 });
  // First time: count the current card as seen so nobody gets an "upgrade" for simply starting.
  const seen = row ? row.seen_overall : card.overall;
  await supabase
    .from("player_cards")
    .upsert({ athlete_id: athleteId, overall: card.overall, tier: card.tier, stats: card.stats, seen_overall: seen, updated_on: today }, { onConflict: "athlete_id" });
  return { ...card, seen };
}

export interface CardSnap {
  overall: number | null;
  tier: Card["tier"];
  stats: Card["stats"];
}

/**
 * Card before and after one finished session (workout summary).
 * The "before" is frozen per log, so reloading the summary shows the same change.
 */
export async function cardChangeForLog(
  supabase: SupabaseClient,
  athleteId: string,
  logId: string,
  profile: { sex?: string | null; weight_class_limit_kg?: number | string | null },
  today: string,
  extra: { pbs: number; sessions: number },
): Promise<{ before: CardSnap | null; after: CardSnap } | null> {
  const { data: row, error } = await supabase
    .from("player_cards")
    .select("overall, tier, stats, prev, last_log")
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (error) return null;
  const after = await loadPlayerCard(supabase, athleteId, profile, today, extra);
  const before: CardSnap | null =
    row?.last_log === logId ? ((row.prev as CardSnap | null) ?? null) : row ? { overall: row.overall, tier: row.tier, stats: row.stats as Card["stats"] } : null;
  await supabase.from("player_cards").upsert(
    { athlete_id: athleteId, overall: after.overall, tier: after.tier, stats: after.stats, seen_overall: after.overall, updated_on: today, prev: before, last_log: logId },
    { onConflict: "athlete_id" },
  );
  return { before, after };
}
