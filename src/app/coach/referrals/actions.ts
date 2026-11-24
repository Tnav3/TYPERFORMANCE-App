"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { coachOnly, friendly, str, UUID } from "@/lib/programming/server";

const P = "/coach/referrals";
function go(error?: string): never {
  revalidatePath(P);
  redirect(error ? `${P}?error=${encodeURIComponent(error)}` : P);
}

export async function saveOffer(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const title = str(fd.get("title"), 80);
  if (!title || title.length < 2) go("Give the offer a title.");
  const row = { title, body: str(fd.get("body"), 1000), reward: str(fd.get("reward"), 200), active: fd.get("active") === "on" };
  const { error } = UUID.test(id)
    ? await supabase.from("referral_offers").update(row).eq("id", id)
    : await supabase.from("referral_offers").insert(row);
  go(error ? friendly(error.message) : undefined);
}

export async function markRewarded(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) {
    const { error } = await supabase
      .from("referrals")
      .update({ rewarded_at: fd.get("undo") ? null : new Date().toISOString() })
      .eq("id", id);
    if (error) go(friendly(error.message));
  }
  go();
}
