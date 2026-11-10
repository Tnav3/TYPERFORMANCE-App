import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sex, Standard } from "./standards";

/** All standards, keyed "test_key:sex". */
export async function getStandards(
  supabase: SupabaseClient,
): Promise<Record<string, Standard>> {
  const { data } = await supabase
    .from("test_standards")
    .select("test_key, sex, bronze, silver, gold, source");
  const num = (x: unknown) => (x == null ? null : Number(x));
  return Object.fromEntries(
    (data ?? []).map((s) => [
      `${s.test_key}:${s.sex}`,
      {
        ...s,
        bronze: num(s.bronze),
        silver: num(s.silver),
        gold: num(s.gold),
      } as Standard,
    ]),
  );
}

export const standardFor = (
  all: Record<string, Standard>,
  key: string,
  sex: Sex | null | undefined,
) => (sex ? (all[`${key}:${sex}`] ?? null) : null);
