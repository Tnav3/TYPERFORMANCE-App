"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WIDGET_KEYS, type HomeTrend } from "@/lib/programming/widgets";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setClientWidgets(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const reset = formData.get("reset") === "1";
  const picked = formData.getAll("w").map(String).filter((k) => (WIDGET_KEYS as string[]).includes(k)).slice(0, 4);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ coach_widgets: reset || !picked.length ? null : picked }).eq("id", id);
  revalidatePath(`/coach/athlete/${id}`);
  if (error) redirect(`/coach/athlete/${id}?error=widgets`);
}

export async function setHomeTrend(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const v = String(formData.get("trend") ?? "");
  if (!UUID.test(id)) return;
  const trend: HomeTrend | null = v === "auto" ? null : (["strength", "bodyweight", "volume", "off"] as const).includes(v as HomeTrend) ? (v as HomeTrend) : null;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ home_trend: trend }).eq("id", id);
  revalidatePath(`/coach/athlete/${id}`);
  revalidatePath("/athlete");
  if (error) redirect(`/coach/athlete/${id}?error=widgets`);
}
