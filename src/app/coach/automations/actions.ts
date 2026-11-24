"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clampThreshold, TEMPLATES, TRIGGERS, type Audience, type Trigger } from "@/lib/automations";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const back = (msg?: string) => redirect(`/coach/automations${msg ? `?error=${encodeURIComponent(msg)}` : ""}`);

function read(fd: FormData) {
  const trigger = String(fd.get("trigger") ?? "") as Trigger;
  if (!(trigger in TRIGGERS)) return null;
  const audience: Audience = fd.get("audience") === "coach" ? "coach" : "client";
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  const body = String(fd.get("body") ?? "").trim().slice(0, 1000) || (audience === "coach" ? "Check in with this client." : "");
  const cooldown = Math.min(366, Math.max(1, Math.round(Number(fd.get("cooldown_days") ?? 7)) || 7));
  const form = String(fd.get("form_id") ?? "");
  return { trigger, audience, name, body, threshold: clampThreshold(trigger, Number(fd.get("threshold"))), cooldown_days: cooldown, form_id: UUID.test(form) ? form : null };
}

export async function addFromTemplate(fd: FormData) {
  const t = TEMPLATES[Number(fd.get("i"))];
  if (!t) return;
  const supabase = await createClient();
  const { error } = await supabase.from("automations").insert({ name: t.name, trigger: t.trigger, threshold: t.threshold, audience: t.audience, body: t.body, cooldown_days: t.cooldown, active: false });
  revalidatePath("/coach/automations");
  if (error) back("That rule didn't save. Please try again.");
}

export async function saveAutomation(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const v = read(fd);
  if (!v || v.name.length < 2 || !v.body) back("Give the rule a name and a message.");
  const supabase = await createClient();
  const { error } = UUID.test(id) ? await supabase.from("automations").update(v!).eq("id", id) : await supabase.from("automations").insert({ ...v!, active: false });
  revalidatePath("/coach/automations");
  if (error) back("That rule didn't save. Please try again.");
}

export async function toggleAutomation(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("automations").update({ active: fd.get("on") === "true" }).eq("id", id);
  revalidatePath("/coach/automations");
}

export async function deleteAutomation(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("automations").delete().eq("id", id);
  revalidatePath("/coach/automations");
}

export async function runNow() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_automations", { p_force: true });
  revalidatePath("/coach/automations");
  redirect(`/coach/automations?ran=${error ? -1 : Number(data ?? 0)}`);
}
