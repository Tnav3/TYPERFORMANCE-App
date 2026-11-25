// Supabase returns at most 1,000 rows per request, and the library is bigger than that.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function allExercises(supabase: SupabaseClient) {
  const out: { id: string; name: string; active: boolean; category: string | null }[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await supabase.from("exercises").select("id, name, active, category").order("name").order("id").range(from, from + 999);
    out.push(...((data ?? []) as typeof out));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Every exercise row with all columns (library page). */
export async function allExerciseRows(supabase: SupabaseClient) {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await supabase.from("exercises").select("*").order("name").order("id").range(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
