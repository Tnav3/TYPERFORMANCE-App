"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signedIn } from "@/lib/programming/server";

export async function savePushSubscription(input: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) {
  const { supabase, user } = await signedIn();
  if (!/^https:\/\//.test(input.endpoint) || input.endpoint.length > 1000 || !input.p256dh || !input.auth)
    return { ok: false as const, error: "That device couldn't be registered." };
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh.slice(0, 200),
      auth: input.auth.slice(0, 100),
      user_agent: input.userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );
  return error ? { ok: false as const, error: "Couldn't save. Try again." } : { ok: true as const };
}

export async function removePushSubscription(endpoint: string) {
  const { supabase, user } = await signedIn();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return { ok: true as const };
}

const TIME = /^\d{2}:\d{2}$/;
export async function saveNotificationPrefs(fd: FormData) {
  const { supabase, user } = await signedIn();
  const wt = String(fd.get("workout_reminder_time") ?? "");
  const ht = String(fd.get("habit_reminder_time") ?? "");
  await supabase
    .from("profiles")
    .update({
      notify_messages: fd.get("notify_messages") === "on",
      notify_workouts: fd.get("notify_workouts") === "on",
      workout_reminder_time: fd.get("workout_reminder") === "on" && TIME.test(wt) ? wt : null,
      habit_reminder_time: fd.get("habit_reminder") === "on" && TIME.test(ht) ? ht : null,
    })
    .eq("id", user.id);
  revalidatePath("/notifications");
  redirect("/notifications?saved=1");
}
