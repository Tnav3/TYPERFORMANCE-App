"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TIPS } from "@/lib/tutorial";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, id: user.id };
}

/** Finished or skipped the welcome tour. */
export async function finishTutorial() {
  const { supabase, id } = await me();
  await supabase
    .from("profiles")
    .update({ tutorial_done_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/athlete");
}

/** "Got it" on a feature tip. */
export async function dismissTip(key: string) {
  if (!Object.hasOwn(TIPS, key)) return;
  const { supabase, id } = await me();
  const { data } = await supabase
    .from("profiles")
    .select("tips_seen")
    .eq("id", id)
    .single();
  const seen: string[] = data?.tips_seen ?? [];
  if (seen.includes(key)) return;
  await supabase
    .from("profiles")
    .update({ tips_seen: [...seen, key] })
    .eq("id", id);
}

/** Replay from the profile page: tour and all tips again. */
export async function replayTutorial() {
  const { supabase, id } = await me();
  await supabase
    .from("profiles")
    .update({ tutorial_done_at: null, tips_seen: [] })
    .eq("id", id);
  revalidatePath("/", "layout");
  redirect("/athlete");
}
