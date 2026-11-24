"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { coachOnly, friendly } from "@/lib/programming/server";
import { cleanEmail } from "@/lib/programming/payments";

const PATH = "/coach/invites";

export async function bulkInvite(fd: FormData) {
  const supabase = await coachOnly();
  const plan = fd.get("plan") === "premium" ? "premium" : "basic";
  const raw = String(fd.get("emails") ?? "");
  const emails = [...new Set(raw.split(/[\s,;]+/).map(cleanEmail).filter((e): e is string => !!e))].slice(0, 500);
  if (!emails.length) redirect(`${PATH}?error=${encodeURIComponent("Paste at least one email.")}`);
  const { data: existing } = await supabase.from("profiles").select("email").in("email", emails);
  const have = new Set((existing ?? []).map((p) => p.email.toLowerCase()));
  const fresh = emails.filter((e) => !have.has(e));
  if (fresh.length) {
    const { error } = await supabase
      .from("invites")
      .upsert(fresh.map((email) => ({ email, plan, auto_approve: true, note: "Bulk invite" })), { onConflict: "email" });
    if (error) redirect(`${PATH}?error=${encodeURIComponent(friendly(error.message))}`);
  }
  revalidatePath(PATH);
  redirect(`${PATH}?added=${fresh.length}&skipped=${emails.length - fresh.length}`);
}

export async function removeInvite(fd: FormData) {
  const supabase = await coachOnly();
  const email = cleanEmail(fd.get("email"));
  if (email) await supabase.from("invites").delete().eq("email", email);
  revalidatePath(PATH);
  redirect(PATH);
}
