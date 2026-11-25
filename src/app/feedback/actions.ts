"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APP_VERSION } from "@/lib/app-version";

export async function sendFeedback(fd: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const message = String(fd.get("message") ?? "").trim().slice(0, 2000);
  const kind = ["bug", "idea", "other"].includes(String(fd.get("kind"))) ? String(fd.get("kind")) : "bug";
  const page = String(fd.get("page") ?? "").slice(0, 200) || null;
  const device = String(fd.get("device") ?? "").slice(0, 300) || null;
  if (message.length < 3) redirect("/feedback?error=1");
  const { error } = await supabase.from("feedback").insert({ kind, message, page, device, app_version: APP_VERSION });
  redirect(error ? "/feedback?error=1" : "/feedback?sent=1");
}
