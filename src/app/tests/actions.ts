"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isISODate, todayISO } from "@/lib/dates";
import { TEST_FIELDS, validateTestValues, youtubeId } from "@/lib/testing";
import { safeNext } from "@/lib/safe-next";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();
  return {
    supabase,
    user,
    isCoach: me?.role === "coach" && me?.status === "active",
  };
}

function dbMessage(msg: string) {
  if (/row-level security/i.test(msg))
    return "You don't have permission to save this.";
  if (/future/i.test(msg)) return "Test date can't be in the future.";
  if (/folder/i.test(msg)) return "Video upload problem. Try again.";
  return "Couldn't save. Please try again.";
}

function checkDate(d: string): string | null {
  if (!isISODate(d)) return "Pick the test date";
  if (d > todayISO()) return "Test date can't be in the future";
  if (d < "2020-01-01") return "Date is too far back";
  return null;
}

function checkBodyweight(raw: FormDataEntryValue | null): {
  value: number | null;
  error?: string;
} {
  const s = String(raw ?? "")
    .trim()
    .replace(",", ".");
  if (!s) return { value: null };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 30 || n > 200)
    return { value: null, error: "Bodyweight between 30 and 200 kg" };
  return { value: Math.round(n * 10) / 10 };
}

export type EntryState = {
  errors?: Record<string, string>;
  message?: string;
  saved?: boolean;
};

/** One test result (athlete for their own field tests; coach for anyone/any test). */
export async function saveTestEntry(
  _prev: EntryState,
  fd: FormData,
): Promise<EntryState> {
  const { supabase, user, isCoach } = await ctx();
  const test_key = String(fd.get("test_key") ?? "");
  if (!TEST_FIELDS[test_key]) return { message: "Unknown test." };
  const athlete_id = isCoach ? String(fd.get("athlete_id") ?? "") : user.id;
  if (!UUID.test(athlete_id)) return { message: "Unknown athlete." };

  const errors: Record<string, string> = {};
  const tested_on = String(fd.get("tested_on") ?? "");
  const dErr = checkDate(tested_on);
  if (dErr) errors.tested_on = dErr;
  const bw = checkBodyweight(fd.get("bodyweight_kg"));
  if (bw.error) errors.bodyweight_kg = bw.error;
  const v = validateTestValues(test_key, fd);
  if (!v.ok) Object.assign(errors, v.errors);
  const notes =
    String(fd.get("notes") ?? "")
      .trim()
      .slice(0, 500) || null;
  const video_path = String(fd.get("video_path") ?? "") || null;
  if (Object.keys(errors).length || !v.ok) return { errors };

  const { error } = await supabase.from("test_entries").insert({
    athlete_id,
    test_key,
    tested_on,
    values: v.values,
    bodyweight_kg: bw.value,
    notes,
    video_path,
  });
  if (error) return { message: dbMessage(error.message) };
  revalidatePath(`/tests/${test_key}`);
  revalidatePath("/tests");
  revalidatePath(`/coach/athlete/${athlete_id}/tests`);
  return { saved: true };
}

/** Coach: a whole ForceDecks testing day in one go (any subset of the battery). */
export async function saveForceDecksDay(
  _prev: EntryState,
  fd: FormData,
): Promise<EntryState> {
  const { supabase, isCoach } = await ctx();
  if (!isCoach)
    return { message: "Only the coach can enter ForceDecks results." };
  const athlete_id = String(fd.get("athlete_id") ?? "");
  if (!UUID.test(athlete_id)) return { message: "Unknown athlete." };
  const tested_on = String(fd.get("tested_on") ?? "");
  const errors: Record<string, string> = {};
  const dErr = checkDate(tested_on);
  if (dErr) errors.tested_on = dErr;
  const bw = checkBodyweight(fd.get("bodyweight_kg"));
  if (bw.error) errors.bodyweight_kg = bw.error;

  const keys = ["cmj", "slj", "sl_iso_squat", "imtp", "plyo_pushup", "rj_10_5"];
  const rows: { test_key: string; values: Record<string, number> }[] = [];
  for (const key of keys) {
    const fields = TEST_FIELDS[key];
    const anyFilled = fields.some(
      (f) => String(fd.get(`${key}.${f.key}`) ?? "").trim() !== "",
    );
    if (!anyFilled) continue;
    const scoped = { get: (n: string) => fd.get(`${key}.${n}`) };
    const v = validateTestValues(key, scoped);
    if (!v.ok)
      for (const [f, msg] of Object.entries(v.errors))
        errors[`${key}.${f}`] = msg;
    else rows.push({ test_key: key, values: v.values });
  }
  if (!rows.length && !Object.keys(errors).length)
    errors._ = "Enter at least one test.";
  if (Object.keys(errors).length) return { errors };

  const { error } = await supabase.from("test_entries").insert(
    rows.map((r) => ({
      ...r,
      athlete_id,
      tested_on,
      bodyweight_kg: bw.value,
    })),
  );
  if (error) return { message: dbMessage(error.message) };
  revalidatePath(`/coach/athlete/${athlete_id}/tests`);
  return { saved: true };
}

export async function deleteTestEntry(fd: FormData) {
  const { supabase } = await ctx();
  const id = String(fd.get("id") ?? "");
  const back = safeNext(String(fd.get("back") ?? ""), "/tests");
  if (!UUID.test(id)) redirect(back);
  const { data: e } = await supabase
    .from("test_entries")
    .select("video_path")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("test_entries").delete().eq("id", id);
  if (!error && e?.video_path)
    await supabase.storage.from("test-videos").remove([e.video_path]);
  revalidatePath(back);
  redirect(back);
}

/** Coach: remove just the clip (frees storage) but keep the result. */
export async function deleteTestVideo(fd: FormData) {
  const { supabase, isCoach } = await ctx();
  const id = String(fd.get("id") ?? "");
  const back = safeNext(String(fd.get("back") ?? ""), "/coach");
  if (!isCoach || !UUID.test(id)) redirect(back);
  const { data: e } = await supabase
    .from("test_entries")
    .select("video_path")
    .eq("id", id)
    .maybeSingle();
  if (e?.video_path) {
    await supabase.storage.from("test-videos").remove([e.video_path]);
    await supabase
      .from("test_entries")
      .update({ video_path: null })
      .eq("id", id);
  }
  revalidatePath(back);
  redirect(back);
}

/** Coach: edit a test's YouTube link and written instructions. */
export async function updateTestDefinition(fd: FormData) {
  const { supabase, isCoach } = await ctx();
  if (!isCoach) redirect("/");
  const key = String(fd.get("key") ?? "");
  const url = String(fd.get("youtube_url") ?? "").trim();
  const instructions =
    String(fd.get("instructions") ?? "")
      .trim()
      .slice(0, 3000) || null;
  if (url && !youtubeId(url))
    redirect(
      `/coach/settings/tests?error=${encodeURIComponent("That isn't a YouTube link.")}#${key}`,
    );
  await supabase
    .from("test_definitions")
    .update({ youtube_url: url || null, instructions })
    .eq("key", key);
  revalidatePath("/coach/settings/tests");
  revalidatePath(`/tests/${key}`);
  redirect(`/coach/settings/tests?saved=${key}#${key}`);
}
