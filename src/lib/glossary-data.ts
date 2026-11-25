import type { SupabaseClient } from "@supabase/supabase-js";
import type { GlossaryTerm } from "@/lib/glossary";

export async function loadGlossary(supabase: SupabaseClient): Promise<GlossaryTerm[]> {
  const { data } = await supabase.from("glossary_terms").select("key, title, aliases, what, how, why").order("sort_order").order("title");
  return (data ?? []) as GlossaryTerm[];
}
