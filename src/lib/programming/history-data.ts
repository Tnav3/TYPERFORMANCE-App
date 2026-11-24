import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoggedSet } from "./history";

/** Every completed set a client has logged, optionally for one exercise. */
export async function loggedSets(
  supabase: SupabaseClient,
  athleteId: string,
  exerciseId?: string,
): Promise<(LoggedSet & { key: string })[]> {
  let q = supabase
    .from("set_logs")
    .select("reps, load_kg, value, workout_items!inner(exercise_id), workout_logs!inner(workout_date, athlete_id)")
    .eq("workout_logs.athlete_id", athleteId)
    .eq("done", true)
    .not("workout_items.exercise_id", "is", null)
    .limit(5000);
  if (exerciseId) q = q.eq("workout_items.exercise_id", exerciseId);
  const { data } = await q;
  return ((data ?? []) as unknown as {
    reps: number | null;
    load_kg: string | null;
    value: string | null;
    workout_items: { exercise_id: string };
    workout_logs: { workout_date: string };
  }[]).map((r) => ({
    key: r.workout_items.exercise_id,
    date: r.workout_logs.workout_date,
    reps: r.reps,
    kg: r.load_kg == null ? null : Number(r.load_kg),
    value: r.value == null ? null : Number(r.value),
  }));
}

export async function bodyweights(supabase: SupabaseClient, athleteId: string, limit = 120) {
  const { data } = await supabase
    .from("body_metrics")
    .select("id, measured_on, weight_kg, waist_cm")
    .eq("athlete_id", athleteId)
    .order("measured_on", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    date: r.measured_on as string,
    kg: Number(r.weight_kg),
    waist: r.waist_cm == null ? null : Number(r.waist_cm),
  }));
}
