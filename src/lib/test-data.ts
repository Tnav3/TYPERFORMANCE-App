import type { SupabaseClient } from "@supabase/supabase-js";
import { headlineValue, pctChange } from "./testing";

export interface TestDef {
  key: string;
  name: string;
  mode: "field" | "forcedecks";
  youtube_url: string | null;
  instructions: string | null;
  sort_order: number;
  active: boolean;
  category: "power" | "strength" | "conditioning" | null;
}

export interface TestEntry {
  id: string;
  athlete_id: string;
  test_key: string;
  tested_on: string;
  values: Record<string, number>;
  bodyweight_kg: number | string | null;
  notes: string | null;
  video_path: string | null;
  entered_by: string;
  created_at: string;
}

export async function getTestDefs(
  supabase: SupabaseClient,
): Promise<TestDef[]> {
  const { data } = await supabase
    .from("test_definitions")
    .select("*")
    .order("sort_order");
  return (data ?? []) as TestDef[];
}

export async function getEntries(
  supabase: SupabaseClient,
  athleteId: string,
  testKey?: string,
): Promise<TestEntry[]> {
  let q = supabase.from("test_entries").select("*").eq("athlete_id", athleteId);
  if (testKey) q = q.eq("test_key", testKey);
  const { data } = await q.order("tested_on").order("created_at");
  return (data ?? []) as TestEntry[];
}

export interface TestSummary {
  def: TestDef;
  entries: TestEntry[];
  first: TestEntry | null;
  previous: TestEntry | null;
  latest: TestEntry | null;
  unit: string | null;
  vsPrevious: number | null; // % change of the headline value
  vsFirst: number | null;
}

/** Intake (first), previous and latest result per test, with % change of the headline number. */
export function summarize(
  defs: TestDef[],
  entries: TestEntry[],
): TestSummary[] {
  return defs.map((def) => {
    const es = entries.filter((e) => e.test_key === def.key);
    const first = es[0] ?? null;
    const latest = es[es.length - 1] ?? null;
    const previous = es.length > 1 ? es[es.length - 2] : null;
    const h = (e: TestEntry | null) =>
      e ? headlineValue(def.key, e.values) : null;
    const hl = h(latest);
    const hp = h(previous);
    const hf = h(first);
    return {
      def,
      entries: es,
      first,
      previous,
      latest,
      unit: hl?.unit ?? null,
      vsPrevious: hl && hp ? pctChange(hp.value, hl.value) : null,
      vsFirst: hl && hf && es.length > 1 ? pctChange(hf.value, hl.value) : null,
    };
  });
}

export function formatPct(p: number | null) {
  if (p == null) return "–";
  return `${p > 0 ? "+" : ""}${p}%`;
}
