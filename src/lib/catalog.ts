import type { SupabaseClient } from "@supabase/supabase-js";

export interface CatalogDiscipline {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  types: { id: string; name: string; active: boolean; sort_order: number }[];
}

/** All disciplines with their session types, in display order (includes hidden ones for old logs). */
export async function getCatalog(
  supabase: SupabaseClient,
): Promise<CatalogDiscipline[]> {
  const [{ data: ds }, { data: ts }] = await Promise.all([
    supabase
      .from("disciplines")
      .select("id, name, active, sort_order, created_at")
      .order("sort_order")
      .order("name"),
    supabase
      .from("session_types")
      .select("id, name, active, discipline_id, sort_order")
      .order("sort_order")
      .order("name"),
  ]);
  return (ds ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    active: d.active,
    sort_order: d.sort_order,
    created_at: d.created_at,
    types: (ts ?? [])
      .filter((t) => t.discipline_id === d.id)
      .map((t) => ({
        id: t.id,
        name: t.name,
        active: t.active,
        sort_order: t.sort_order,
      })),
  }));
}

export function catalogNames(catalog: CatalogDiscipline[]) {
  const disc = new Map<string, string>();
  const type = new Map<string, string>();
  for (const d of catalog) {
    disc.set(d.id, d.name);
    for (const t of d.types) type.set(t.id, t.name);
  }
  return { disc, type };
}
