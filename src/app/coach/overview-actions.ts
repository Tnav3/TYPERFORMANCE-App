"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { coachOnly, ISO_DATE, safePath, signedIn, str, UUID } from "@/lib/programming/server";
import { OVERVIEW_CARDS } from "@/lib/programming/overview";

export async function saveDashboardPrefs(fd: FormData) {
  const { supabase, user, isCoach } = await signedIn();
  if (!isCoach) redirect("/");
  const shown = new Set(fd.getAll("show").map(String));
  const hidden = OVERVIEW_CARDS.map((c) => c[0]).filter((k) => !shown.has(k));
  await supabase.from("profiles").update({ dashboard_prefs: { hidden } }).eq("id", user.id);
  revalidatePath("/coach");
  redirect("/coach");
}

export async function addFollowUp(fd: FormData) {
  const supabase = await coachOnly();
  const athlete = String(fd.get("athlete_id") ?? "");
  const due = String(fd.get("due_on") ?? "");
  const note = str(fd.get("note"), 500);
  const back = safePath(fd.get("back"), "/coach");
  if (!UUID.test(athlete) || !ISO_DATE.test(due) || !note)
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent("Add a date and a note.")}`);
  await supabase.from("follow_ups").insert({ athlete_id: athlete, due_on: due, note });
  revalidatePath(back.split("?")[0]);
  redirect(back);
}

export async function clearFollowUp(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const back = safePath(fd.get("back"), "/coach");
  if (UUID.test(id)) await supabase.from("follow_ups").update({ done_at: new Date().toISOString() }).eq("id", id);
  revalidatePath(back.split("?")[0]);
  redirect(back);
}
