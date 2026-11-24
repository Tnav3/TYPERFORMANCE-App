"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { coachOnly, friendly, int, str, UUID } from "@/lib/programming/server";
import { sydneyToUtc } from "@/lib/programming/schedule";

const PATH = "/coach/messages";
function go(error?: string): never {
  revalidatePath(PATH);
  redirect(error ? `${PATH}?error=${encodeURIComponent(error)}` : `${PATH}?saved=1`);
}

export async function createScheduled(fd: FormData) {
  const supabase = await coachOnly();
  const body = str(fd.get("body"), 2000);
  if (!body) go("Write the message.");
  const [kind, id] = String(fd.get("target") ?? "all").split(":");
  const target = kind === "a" ? "athlete" : kind === "g" ? "group" : "all";
  if (target !== "all" && !UUID.test(id ?? "")) go("Pick who it goes to.");
  const repeat = String(fd.get("repeat") ?? "none");
  const time = String(fd.get("time") ?? "09:00");
  if (!/^\d{2}:\d{2}$/.test(time)) go("Pick a time.");
  const row: Record<string, unknown> = {
    body,
    target,
    athlete_id: target === "athlete" ? id : null,
    group_id: target === "group" ? id : null,
    repeat,
    time_of_day: time,
  };
  if (repeat === "none") {
    const at = sydneyToUtc(String(fd.get("date") ?? ""), time);
    if (!at) go("Pick a date and time.");
    if (new Date(at!).getTime() < Date.now() - 60000) go("That time has already passed.");
    row.next_send_at = at;
  } else if (repeat === "weekly") {
    const days = fd.getAll("weekdays").map(Number).filter((d) => d >= 1 && d <= 7);
    if (!days.length) go("Pick at least one day.");
    row.weekdays = [...new Set(days)];
  } else if (repeat === "days") {
    const n = int(fd.get("every_days"));
    if (!n || n < 1 || n > 90) go("Repeat every 1–90 days.");
    row.every_days = n;
  } else go("Pick how often.");
  const { error } = await supabase.from("scheduled_messages").insert(row);
  go(error ? friendly(error.message) : undefined);
}

export async function setScheduledActive(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id))
    await supabase.from("scheduled_messages").update({ active: fd.get("active") === "true" }).eq("id", id);
  go();
}

export async function deleteScheduled(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("scheduled_messages").delete().eq("id", id);
  go();
}

/** Send a message to many clients right now (announcement). */
export async function sendNow(fd: FormData) {
  const supabase = await coachOnly();
  const body = str(fd.get("body"), 2000);
  if (!body) go("Write the message.");
  const [kind, id] = String(fd.get("target") ?? "all").split(":");
  let q = supabase.from("profiles").select("id").eq("role", "athlete").eq("status", "active").eq("feat_chat", true);
  if (kind === "a" && UUID.test(id ?? "")) q = q.eq("id", id);
  if (kind === "g" && UUID.test(id ?? "")) {
    const { data: m } = await supabase.from("group_members").select("athlete_id").eq("group_id", id);
    q = q.in("id", (m ?? []).map((x) => x.athlete_id));
  }
  const { data: people } = await q;
  if (!people?.length) go("Nobody to send to (check chat is on for them).");
  const { error } = await supabase.from("messages").insert(people!.map((p) => ({ athlete_id: p.id, body })));
  go(error ? friendly(error.message) : undefined);
}
