"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { coachOnly, str, UUID } from "@/lib/programming/server";
import { parsePrice, slugify, type Billing } from "@/lib/shop";

const PATH = "/coach/shop";
function back(error?: string, anchor?: string): never {
  revalidatePath(PATH);
  revalidatePath("/shop", "layout");
  redirect(`${PATH}${error ? `?error=${encodeURIComponent(error)}` : "?saved=1"}${anchor ? `#${anchor}` : ""}`);
}

type Db = Awaited<ReturnType<typeof coachOnly>>;
async function stats(supabase: Db, programId: string) {
  const { data: p } = await supabase.from("programs").select("weeks").eq("id", programId).maybeSingle();
  const { count } = await supabase.from("program_days").select("id", { count: "exact", head: true }).eq("program_id", programId).eq("week_no", 1);
  return { weeks: p?.weeks ?? null, sessions_per_week: count ?? null };
}

/** Start selling a program: creates a hidden product with sensible defaults. */
export async function sellProgram(fd: FormData) {
  const supabase = await coachOnly();
  const programId = String(fd.get("program_id") ?? "");
  if (!UUID.test(programId)) back("Pick a program.");
  const { data: prog } = await supabase.from("programs").select("name, description").eq("id", programId).maybeSingle();
  if (!prog) back("Program not found.");
  let slug = slugify(prog!.name);
  const { count } = await supabase.from("shop_products").select("id", { count: "exact", head: true }).like("slug", `${slug}%`);
  if (count) slug = `${slug}-${count + 1}`.slice(0, 60);
  const { data, error } = await supabase
    .from("shop_products")
    .insert({
      program_id: programId,
      slug,
      title: prog!.name.slice(0, 80),
      description: prog!.description?.slice(0, 4000) ?? null,
      price_cents: 0,
      ...(await stats(supabase, programId)),
      sort_order: 100,
    })
    .select("id")
    .single();
  back(error ? "That didn't save. Please try again." : undefined, data ? `p-${data.id}` : undefined);
}

export async function updateProduct(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) back();
  const title = str(fd.get("title"), 80);
  const price = parsePrice(fd.get("price"));
  const billing = String(fd.get("billing") ?? "once") as Billing;
  const count = Number(fd.get("billing_count")) || null;
  const url = str(fd.get("checkout_url"), 500);
  const active = fd.get("active") === "on";
  const anchor = `p-${id}`;
  if (!title || title.length < 3) back("Give it a name.", anchor);
  if (price == null) back("Enter a price like 14.99.", anchor);
  if (!["once", "weekly", "monthly"].includes(billing)) back("Pick how it's billed.", anchor);
  if (url && !/^https:\/\/\S+$/.test(url)) back("The checkout link must start with https://", anchor);
  if (active && !url) back("Add the MxP or Stripe checkout link before you put it on sale.", anchor);
  const { data: row } = await supabase.from("shop_products").select("program_id").eq("id", id).maybeSingle();
  if (!row) back();
  const { error } = await supabase
    .from("shop_products")
    .update({
      title,
      tagline: str(fd.get("tagline"), 160),
      description: str(fd.get("description"), 4000),
      price_cents: price,
      billing,
      billing_count: billing === "once" ? null : count && count >= 1 && count <= 104 ? count : null,
      checkout_url: url,
      match_name: str(fd.get("match_name"), 100),
      start_rule: fd.get("start_rule") === "purchase" ? "purchase" : "next_monday",
      trial_days: (() => { const t = Number(fd.get("trial_days")); return Number.isInteger(t) && t >= 1 && t <= 28 ? t : null; })(),
      active,
      ...(await stats(supabase, row!.program_id)),
    })
    .eq("id", id);
  back(error ? (/match_idx|duplicate/.test(error.message) ? "Another product already uses that MxP name." : "That didn't save. Please try again.") : undefined, anchor);
}

export async function removeProduct(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) back();
  const { count } = await supabase.from("shop_purchases").select("id", { count: "exact", head: true }).eq("product_id", id);
  if (count) {
    await supabase.from("shop_products").update({ active: false }).eq("id", id);
    back("It has orders, so it's been taken off sale instead of deleted.");
  }
  await supabase.from("shop_products").delete().eq("id", id);
  back();
}
