import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lift } from "./calculator";

export interface LiftMax {
  id: string;
  lift_key: string;
  load_kg: number;
  reps: number;
  bodyweight_kg: number | null;
  e1rm_kg: number;
  saved_on: string;
  created_at: string;
}

export async function getLifts(supabase: SupabaseClient): Promise<Lift[]> {
  const { data } = await supabase
    .from("lifts")
    .select("*")
    .order("sort_order")
    .order("name");
  return (data ?? []) as Lift[];
}

export async function getMaxes(
  supabase: SupabaseClient,
  athleteId: string,
): Promise<LiftMax[]> {
  const { data } = await supabase
    .from("lift_maxes")
    .select("id, lift_key, load_kg, reps, bodyweight_kg, e1rm_kg, saved_on, created_at")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    ...r,
    load_kg: Number(r.load_kg),
    e1rm_kg: Number(r.e1rm_kg),
    bodyweight_kg: r.bodyweight_kg == null ? null : Number(r.bodyweight_kg),
  })) as LiftMax[];
}

export async function latestBodyweight(
  supabase: SupabaseClient,
  athleteId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("weekly_checkins")
    .select("bodyweight_kg")
    .eq("athlete_id", athleteId)
    .not("bodyweight_kg", "is", null)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.bodyweight_kg == null ? null : Number(data.bodyweight_kg);
}
