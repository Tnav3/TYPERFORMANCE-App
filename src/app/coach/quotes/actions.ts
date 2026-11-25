"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { coachOnly, friendly, str, UUID } from "@/lib/programming/server";
import { noEmDash } from "@/lib/nutrition/plan-content";

const go = (error?: string): never => {
  revalidatePath("/coach/quotes");
  redirect(error ? `/coach/quotes?error=${encodeURIComponent(error)}` : "/coach/quotes");
};

export async function addQuote(fd: FormData) {
  const supabase = await coachOnly();
  const body = str(fd.get("body"), 240);
  if (!body || body.length < 5) go("Write at least a few words.");
  const { error } = await supabase.from("quotes").insert({ body: noEmDash(body!), author: str(fd.get("author"), 80) });
  go(error ? friendly(error.message) : undefined);
}
export async function toggleQuote(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("quotes").update({ active: fd.get("active") !== "true" }).eq("id", id);
  go();
}
export async function deleteQuote(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("quotes").delete().eq("id", id);
  go();
}
