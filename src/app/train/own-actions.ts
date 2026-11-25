"use server";
// Clients building their own workout (a day with nothing on, or extra work they did).
import { revalidatePath } from "next/cache";
import { signedIn, UUID } from "@/lib/programming/server";
import { isISODate, todayISO } from "@/lib/dates";
import { addDays } from "@/lib/week";
import { subLabel } from "@/lib/programming/types";

export interface PickExercise {
  id: string;
  name: string;
  sub: string | null;
}

/** Search the library; with no search, the exercises this client has done most recently. */
export async function findExercises(search: string): Promise<PickExercise[]> {
  const { supabase, user } = await signedIn();
  const term = search.trim().slice(0, 60).replace(/[%_,()]/g, " ");
  if (term.length >= 2) {
    const { data } = await supabase.from("exercises").select("id, name, category, subcategory").eq("active", true).ilike("name", `%${term}%`).order("name").limit(25);
    return (data ?? []).map((e) => ({ id: e.id, name: e.name, sub: subLabel(e.category, e.subcategory) }));
  }
  const { data } = await supabase
    .from("set_logs")
    .select("exercise_id, exercises(name, category, subcategory), workout_logs!inner(athlete_id, workout_date)")
    .eq("workout_logs.athlete_id", user.id)
    .not("exercise_id", "is", null)
    .order("workout_logs(workout_date)", { ascending: false }) // sorts the set rows by their session date, newest first
    .limit(300);
  const seen = new Map<string, PickExercise>();
  for (const r of (data ?? []) as unknown as { exercise_id: string; exercises: { name: string; category: string; subcategory: string | null } | null }[]) {
    if (!r.exercises || seen.has(r.exercise_id)) continue;
    seen.set(r.exercise_id, { id: r.exercise_id, name: r.exercises.name, sub: subLabel(r.exercises.category, r.exercises.subcategory) });
    if (seen.size >= 12) break;
  }
  return [...seen.values()];
}

export async function createOwnWorkout(input: {
  date: string;
  title: string;
  items: { exerciseId: string; sets: number | null; reps: string | null }[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const today = todayISO();
  if (!isISODate(input.date) || input.date < addDays(today, -14) || input.date > addDays(today, 1))
    return { ok: false, error: "Pick a day from the last two weeks (or tomorrow)." };
  const items = input.items.filter((i) => UUID.test(i.exerciseId)).slice(0, 30);
  if (!items.length) return { ok: false, error: "Add at least one exercise." };
  const title = input.title.trim().replace(/\s+/g, " ").slice(0, 80) || "My workout";
  const { supabase, user } = await signedIn();
  const { data: w, error } = await supabase
    .from("workouts")
    .insert({ athlete_id: user.id, workout_date: input.date, title, created_by: user.id })
    .select("id")
    .single();
  if (error || !w) return { ok: false, error: "That didn't save. Please try again." };
  const rows = items.map((i, k) => ({
    workout_id: w.id,
    kind: "exercise",
    exercise_id: i.exerciseId,
    position: k + 1,
    block: String.fromCharCode(65 + Math.min(k, 25)),
    slot: 1,
    sets: i.sets && i.sets >= 1 && i.sets <= 20 ? Math.round(i.sets) : 3,
    reps: i.reps?.trim().slice(0, 20) || null,
  }));
  const { error: e2 } = await supabase.from("workout_items").insert(rows);
  if (e2) {
    await supabase.from("workouts").delete().eq("id", w.id);
    return { ok: false, error: "That didn't save. Please try again." };
  }
  revalidatePath("/train");
  return { ok: true, id: w.id };
}

/** Delete a workout the client made (only theirs; the database checks). */
export async function deleteOwnWorkout(id: string): Promise<{ ok: boolean }> {
  if (!UUID.test(id)) return { ok: false };
  const { supabase, user } = await signedIn();
  const { error } = await supabase.from("workouts").delete().eq("id", id).eq("created_by", user.id);
  revalidatePath("/train");
  return { ok: !error };
}

/** Move a workout to another day (group workouts become the client's own copy). */
export async function moveMyWorkout(id: string, date: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID.test(id) || !isISODate(date)) return { ok: false, error: "Pick a day." };
  const { supabase } = await signedIn();
  const { error } = await supabase.rpc("move_my_workout", { p_workout: id, p_date: date });
  if (error) return { ok: false, error: /finished|4 weeks|not found/.test(error.message) ? error.message : "That didn't move. Please try again." };
  revalidatePath("/train");
  revalidatePath("/athlete");
  return { ok: true };
}
