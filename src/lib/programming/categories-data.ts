// Exercise categories live in the database (coach can add/rename). Falls back to the built-in list.
import type { SupabaseClient } from "@supabase/supabase-js";
import { EXERCISE_CATEGORIES, SUBCATEGORIES } from "./types";

export interface Categories {
  cats: [string, string][];
  subs: Record<string, [string, string][]>;
}

export const DEFAULT_CATEGORIES: Categories = {
  cats: EXERCISE_CATEGORIES.map(([k, l]) => [k, l]),
  subs: Object.fromEntries(Object.entries(SUBCATEGORIES).map(([k, v]) => [k, v.map(([a, b]) => [a, b] as [string, string])])),
};

export async function loadCategories(supabase: SupabaseClient): Promise<Categories> {
  const [{ data: c, error }, { data: s }] = await Promise.all([
    supabase.from("exercise_categories").select("key, label, sort_order").order("sort_order").order("label"),
    supabase.from("exercise_subcategories").select("category, key, label, sort_order").order("sort_order").order("label"),
  ]);
  if (error || !c?.length) return DEFAULT_CATEGORIES;
  const subs: Record<string, [string, string][]> = {};
  for (const r of c) subs[r.key] = [];
  for (const r of s ?? []) (subs[r.category] ??= []).push([r.key, r.label]);
  return { cats: c.map((r) => [r.key, r.label]), subs };
}

export const labelOf = (c: Categories, cat: string, sub: string | null | undefined) =>
  (sub && c.subs[cat]?.find(([k]) => k === sub)?.[1]) || null;

/** "Mobility & Flexibility" → "mobility_flexibility" */
export function slugKey(label: string): string {
  const s = label.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);
  return /^[a-z]/.test(s) && s.length >= 2 ? s : `c_${s}`.slice(0, 30);
}
