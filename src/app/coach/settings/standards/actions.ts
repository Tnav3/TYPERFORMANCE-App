"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateStandard } from "@/lib/standards";

const PAGE = "/coach/settings/standards";

export async function saveStandard(fd: FormData) {
  const test_key = String(fd.get("test_key") ?? "");
  const sex = String(fd.get("sex") ?? "");
  if (!/^[a-z0-9_]{2,40}$/.test(test_key) || !["male", "female"].includes(sex))
    redirect(PAGE);
  const v = validateStandard({
    bronze: String(fd.get("bronze") ?? ""),
    silver: String(fd.get("silver") ?? ""),
    gold: String(fd.get("gold") ?? ""),
  });
  const back = (q: string) => redirect(`${PAGE}?${q}#${test_key}`);
  if ("error" in v)
    back(`error=${encodeURIComponent(v.error!)}&at=${test_key}`);
  const source =
    String(fd.get("source") ?? "")
      .trim()
      .slice(0, 500) || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("test_standards")
    .upsert({
      test_key,
      sex,
      ...v.ok!,
      source,
      updated_at: new Date().toISOString(),
    });
  revalidatePath(PAGE);
  revalidatePath("/tests", "layout");
  if (error)
    back(
      `error=${encodeURIComponent("Couldn't save. Please try again.")}&at=${test_key}`,
    );
  back(`saved=${test_key}-${sex}`);
}
