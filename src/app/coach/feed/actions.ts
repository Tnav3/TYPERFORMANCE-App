"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { coachOnly, safePath, str, UUID } from "@/lib/programming/server";
import { formatDate } from "@/lib/dates";
import { isReaction, replyBody } from "@/lib/reactions";

function back(to: string, error?: string): never {
  revalidatePath("/coach");
  revalidatePath("/coach/feed");
  const [path, hash] = to.split("#");
  redirect(`${path}${error ? `${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : ""}${hash ? `#${hash}` : ""}`);
}

/** One tap: 👍 🔥 💪 👏. Tapping the same one again takes it back. The client is notified. */
export async function reactToLog(fd: FormData) {
  const supabase = await coachOnly();
  const to = safePath(fd.get("back"), "/coach");
  const id = String(fd.get("log_id") ?? "");
  const emoji = fd.get("emoji");
  if (!UUID.test(id) || !isReaction(emoji)) back(to);
  const { data: cur } = await supabase.from("workout_logs").select("coach_reaction, coach_seen_at").eq("id", id).maybeSingle();
  const now = new Date().toISOString();
  const next = cur?.coach_reaction === emoji ? null : emoji;
  const { error } = await supabase
    .from("workout_logs")
    .update({ coach_reaction: next, coach_reacted_at: next ? now : null, coach_seen_at: cur?.coach_seen_at ?? now })
    .eq("id", id);
  back(to, error ? "That didn't save. Please try again." : undefined);
}

/** Quick reply: lands in their chat, quoting the session. */
export async function replyToLog(fd: FormData) {
  const supabase = await coachOnly();
  const to = safePath(fd.get("back"), "/coach");
  const id = String(fd.get("log_id") ?? "");
  const text = str(fd.get("body"), 1800);
  if (!UUID.test(id) || !text) back(to);
  const { data: log } = await supabase
    .from("workout_logs")
    .select("athlete_id, workout_date, coach_seen_at, workouts(title)")
    .eq("id", id)
    .maybeSingle();
  if (!log) back(to);
  const title = (log!.workouts as unknown as { title: string } | null)?.title;
  const { error } = await supabase.from("messages").insert({ athlete_id: log!.athlete_id, body: replyBody(title, formatDate(log!.workout_date), text!) });
  if (!error && !log!.coach_seen_at) await supabase.from("workout_logs").update({ coach_seen_at: new Date().toISOString() }).eq("id", id);
  back(to, error ? "That message didn't send. Please try again." : undefined);
}
