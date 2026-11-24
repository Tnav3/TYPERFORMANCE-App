"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { coachOnly, friendly, int, str, UUID } from "@/lib/programming/server";

const LIST = "/coach/sequences";
const page = (id: string) => `${LIST}/${id}`;
function go(path: string, error?: string): never {
  revalidatePath(path.split("?")[0]);
  redirect(error ? `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : path);
}

export async function createSequence(fd: FormData) {
  const supabase = await coachOnly();
  const name = str(fd.get("name"), 80);
  if (!name || name.length < 2) go(LIST, "Name the sequence.");
  const trigger = fd.get("trigger") === "manual" ? "manual" : "approved";
  const { data, error } = await supabase.from("sequences").insert({ name, trigger }).select("id").single();
  if (error) go(LIST, friendly(error.message));
  if (fd.get("starter") === "on") {
    await supabase.from("sequence_steps").insert([
      { sequence_id: data!.id, day_offset: 0, send_time: "09:00", body: "Welcome to TYPERFORMANCE, {first_name}! Your first sessions are in the Training tab. Tap Turn on notifications on the home screen so you don't miss anything." },
      { sequence_id: data!.id, day_offset: 3, send_time: "18:00", body: "Hey {first_name}, how are the first few sessions feeling? Anything too heavy, too light or confusing? Just reply here." },
      { sequence_id: data!.id, day_offset: 7, send_time: "18:00", body: "One week in, nice work {first_name}. Don't forget your readiness check before each session and your notes after. They help me adjust your program." },
      { sequence_id: data!.id, day_offset: 14, send_time: "18:00", body: "Two weeks done! Check My Progress to see your numbers moving. Anything you want more or less of?" },
    ]);
  }
  go(page(data!.id));
}

export async function updateSequence(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) go(LIST);
  const patch: Record<string, unknown> = {};
  const name = str(fd.get("name"), 80);
  if (name) patch.name = name;
  if (fd.has("trigger")) patch.trigger = fd.get("trigger") === "manual" ? "manual" : "approved";
  if (fd.has("active")) patch.active = fd.get("active") === "true";
  const { error } = await supabase.from("sequences").update(patch).eq("id", id);
  go(page(id), error ? friendly(error.message) : undefined);
}

export async function deleteSequence(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("sequences").delete().eq("id", id);
  go(LIST);
}

export async function saveStep(fd: FormData) {
  const supabase = await coachOnly();
  const seq = String(fd.get("sequence_id") ?? "");
  const id = String(fd.get("id") ?? "");
  const day = int(fd.get("day_offset"));
  const time = String(fd.get("send_time") ?? "09:00");
  const body = str(fd.get("body"), 2000);
  if (!UUID.test(seq)) go(LIST);
  if (day == null || day < 0 || day > 365) go(page(seq), "Day must be 0–365.");
  if (!/^\d{2}:\d{2}$/.test(time)) go(page(seq), "Pick a time.");
  if (!body) go(page(seq), "Write the message.");
  const row = { sequence_id: seq, day_offset: day, send_time: time, body };
  const { error } = UUID.test(id)
    ? await supabase.from("sequence_steps").update(row).eq("id", id)
    : await supabase.from("sequence_steps").insert(row);
  go(page(seq), error ? friendly(error.message) : undefined);
}

export async function deleteStep(fd: FormData) {
  const supabase = await coachOnly();
  const seq = String(fd.get("sequence_id") ?? "");
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("sequence_steps").delete().eq("id", id);
  go(page(seq));
}

export async function enrol(fd: FormData) {
  const supabase = await coachOnly();
  const seq = String(fd.get("sequence_id") ?? "");
  const athlete = String(fd.get("athlete_id") ?? "");
  const start = String(fd.get("start") ?? "");
  if (!UUID.test(seq) || !UUID.test(athlete)) go(page(seq), "Pick a client.");
  const { error } = await supabase
    .from("sequence_enrollments")
    .upsert({ sequence_id: seq, athlete_id: athlete, stopped_at: null, ...(/^\d{4}-\d{2}-\d{2}$/.test(start) ? { started_on: start } : {}) }, { onConflict: "sequence_id,athlete_id" });
  go(page(seq), error ? friendly(error.message) : undefined);
}

export async function stopEnrolment(fd: FormData) {
  const supabase = await coachOnly();
  const seq = String(fd.get("sequence_id") ?? "");
  const athlete = String(fd.get("athlete_id") ?? "");
  if (UUID.test(seq) && UUID.test(athlete))
    await supabase.from("sequence_enrollments").update({ stopped_at: new Date().toISOString() }).eq("sequence_id", seq).eq("athlete_id", athlete);
  go(page(seq));
}
