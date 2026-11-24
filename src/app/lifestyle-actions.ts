"use server";
// Habits, macros, progress photos: client + coach actions.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { todayISO } from "@/lib/dates";
import { coachOnly, friendly, int, ISO_DATE, safePath, signedIn, str, UUID } from "@/lib/programming/server";

function go(path: string, error?: string): never {
  revalidatePath(path.split(/[?#]/)[0]);
  redirect(error ? `${path.split("#")[0]}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : path);
}

// ---------- Client ----------
export async function toggleHabit(fd: FormData) {
  const { supabase, user } = await signedIn();
  const habit = String(fd.get("habit_id") ?? "");
  const day = String(fd.get("day") ?? todayISO());
  if (!UUID.test(habit) || !ISO_DATE.test(day)) go("/habits");
  if (fd.get("done") === "true") {
    await supabase.from("habit_logs").delete().eq("habit_id", habit).eq("day", day).eq("athlete_id", user.id);
    go("/habits");
  }
  const { error } = await supabase.from("habit_logs").insert({ habit_id: habit, day, athlete_id: user.id });
  go("/habits", error ? friendly(error.message) : undefined);
}

export async function saveMacros(fd: FormData) {
  const { supabase, user } = await signedIn();
  const day = String(fd.get("day") ?? todayISO());
  if (!ISO_DATE.test(day)) go("/macros");
  const row = {
    athlete_id: user.id,
    day,
    calories: int(fd.get("calories")),
    protein_g: int(fd.get("protein_g")),
    carbs_g: int(fd.get("carbs_g")),
    fat_g: int(fd.get("fat_g")),
  };
  if (row.calories == null && row.protein_g == null && row.carbs_g == null && row.fat_g == null)
    go("/macros", "Enter at least one number.");
  const { error } = await supabase.from("macro_logs").upsert(row, { onConflict: "athlete_id,day" });
  go(error ? `/macros?error=${encodeURIComponent(friendly(error.message))}` : "/macros?saved=1");
}

/** Called after the browser uploads the file to storage. */
export async function recordPhoto(input: { path: string; pose: string; takenOn: string }) {
  const { supabase, user } = await signedIn();
  if (!input.path.startsWith(`${user.id}/`) || !["front", "side", "back", "other"].includes(input.pose) || !ISO_DATE.test(input.takenOn))
    return { ok: false as const, error: "Upload failed." };
  const { error } = await supabase
    .from("progress_photos")
    .insert({ athlete_id: user.id, path: input.path, pose: input.pose, taken_on: input.takenOn > todayISO() ? todayISO() : input.takenOn });
  revalidatePath("/photos");
  return error ? { ok: false as const, error: friendly(error.message) } : { ok: true as const };
}

export async function deletePhoto(fd: FormData) {
  const { supabase, user, isCoach } = await signedIn();
  const id = String(fd.get("id") ?? "");
  const back = safePath(fd.get("back"), "/photos");
  if (!UUID.test(id)) go(back);
  const { data } = await supabase.from("progress_photos").select("path, athlete_id").eq("id", id).maybeSingle();
  if (data && (isCoach || data.athlete_id === user.id)) {
    await supabase.storage.from("progress-photos").remove([data.path]);
    await supabase.from("progress_photos").delete().eq("id", id);
  }
  go(back);
}

// ---------- Coach ----------
const coachPage = (id: string) => `/coach/athlete/${id}/lifestyle`;

export async function addHabit(fd: FormData) {
  const supabase = await coachOnly();
  const athlete = String(fd.get("athlete_id") ?? "");
  const name = str(fd.get("name"), 80);
  if (!UUID.test(athlete)) go("/coach");
  if (!name || name.length < 2) go(coachPage(athlete), "Name the habit.");
  const { error } = await supabase.from("habits").insert({ athlete_id: athlete, name });
  go(coachPage(athlete), error ? friendly(error.message) : undefined);
}

export async function setHabitActive(fd: FormData) {
  const supabase = await coachOnly();
  const athlete = String(fd.get("athlete_id") ?? "");
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("habits").update({ active: fd.get("active") === "true" }).eq("id", id);
  go(coachPage(athlete));
}

export async function setMacroTargets(fd: FormData) {
  const supabase = await coachOnly();
  const athlete = String(fd.get("athlete_id") ?? "");
  if (!UUID.test(athlete)) go("/coach");
  const { error } = await supabase.from("macro_targets").upsert(
    {
      athlete_id: athlete,
      calories: int(fd.get("calories")),
      protein_g: int(fd.get("protein_g")),
      carbs_g: int(fd.get("carbs_g")),
      fat_g: int(fd.get("fat_g")),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id" },
  );
  go(coachPage(athlete), error ? friendly(error.message, "Check the numbers are realistic.") : undefined);
}
