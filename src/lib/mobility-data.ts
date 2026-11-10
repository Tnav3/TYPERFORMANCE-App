import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normaliseEntry,
  normaliseMeasure,
  type RomEntry,
  type RomMeasure,
} from "./mobility";

export async function getRomMeasures(
  supabase: SupabaseClient,
): Promise<RomMeasure[]> {
  const { data } = await supabase
    .from("rom_measures")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  return (data ?? []).map(normaliseMeasure);
}

export async function getRomEntries(
  supabase: SupabaseClient,
  athleteId: string,
): Promise<RomEntry[]> {
  const { data } = await supabase
    .from("rom_entries")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("measured_on", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []).map(normaliseEntry);
}
