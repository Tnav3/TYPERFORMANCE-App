import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sex, Standard } from "./standards";
import { ufcClassForLimit, ufcCmjStandard } from "./ufc-cmj";

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

/**
 * The standard for one test and sex. CMJ with a known weight-class limit uses
 * the matching UFC division's tiers; otherwise the coach-editable row.
 */
export function standardFor(
  all: Record<string, Standard>,
  key: string,
  sex: Sex | null | undefined,
  limitKg?: number | string | null,
): Standard | null {
  if (!sex) return null;
  if (key === "cmj" && limitKg != null) {
    const c = ufcClassForLimit(sex, Number(limitKg));
    if (c) return ufcCmjStandard(c);
  }
  return all[`${key}:${sex}`] ?? null;
}
