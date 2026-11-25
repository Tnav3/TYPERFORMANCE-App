"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { coachOnly, str, UUID } from "@/lib/programming/server";

const PATH = "/coach/settings/plans";
const CADENCE = ["weekly", "fortnightly", "monthly", "per_session"];

export async function savePlan(fd: FormData) {
  const supabase = await coachOnly();
  const key = String(fd.get("key") ?? "");
  const url = String(fd.get("booking_url") ?? "").trim();
  if (url && !/^https:\/\/\S+$/.test(url)) redirect(`${PATH}?error=${encodeURIComponent("Booking links must start with https://")}#${key}`);
  const cadence = String(fd.get("cadence") ?? "");
  const { error } = await supabase
    .from("coaching_plans")
    .update({
      name: str(fd.get("name"), 40) ?? key,
      cadence: CADENCE.includes(cadence) ? cadence : null,
      booking_label: str(fd.get("booking_label"), 60),
      booking_url: url || null,
      active: fd.get("active") === "on",
    })
    .eq("key", key);
  revalidatePath(PATH);
  revalidatePath("/athlete");
  redirect(error ? `${PATH}?error=${encodeURIComponent("That didn't save.")}` : `${PATH}?saved=${key}#${key}`);
}

export async function setClientPlan(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) return;
  const plan = String(fd.get("plan") ?? "");
  const supabase = await coachOnly();
  await supabase.from("profiles").update({ plan_key: /^[a-z][a-z0-9_]{1,29}$/.test(plan) ? plan : null }).eq("id", id);
  revalidatePath(`/coach/athlete/${id}/profile`);
  revalidatePath("/coach/clients");
}

export async function setBeta(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await coachOnly();
  await supabase.from("profiles").update({ beta: fd.get("beta") === "true" }).eq("id", id);
  revalidatePath(`/coach/athlete/${id}/profile`);
}

export async function setAssignedCoach(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) return;
  const coach = String(fd.get("coach") ?? "");
  const supabase = await coachOnly();
  await supabase.from("profiles").update({ assigned_coach: UUID.test(coach) ? coach : null }).eq("id", id);
  revalidatePath(`/coach/athlete/${id}/profile`);
  revalidatePath("/coach/clients");
}
