"use server";
// Calendar actions called from the drag-and-drop planner. They return errors instead of redirecting.
import { revalidatePath } from "next/cache";
import { coachOnly, friendly, ISO_DATE, UUID } from "@/lib/programming/server";

type Result = { error?: string };

/** Move one of this client's own workouts to another day. Group workouts stay put. */
export async function moveWorkout(athleteId: string, workoutId: string, date: string): Promise<Result> {
  if (!UUID.test(athleteId) || !UUID.test(workoutId) || !ISO_DATE.test(date)) return { error: "Couldn't move that workout." };
  const supabase = await coachOnly();
  const { data: w } = await supabase.from("workouts").select("athlete_id, group_id").eq("id", workoutId).maybeSingle();
  if (!w) return { error: "Workout not found." };
  if (w.group_id) return { error: "That's a group workout. Move it from the group's calendar, or personalise it first." };
  if (w.athlete_id !== athleteId) return { error: "That workout belongs to someone else." };
  const { error } = await supabase.from("workouts").update({ workout_date: date }).eq("id", workoutId);
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/coach/athlete/${athleteId}/program`);
  return {};
}

/** Copy a workout to another day for the same client (Alt/Option-drag). */
export async function copyWorkout(athleteId: string, workoutId: string, date: string): Promise<Result> {
  if (!UUID.test(athleteId) || !UUID.test(workoutId) || !ISO_DATE.test(date)) return { error: "Couldn't copy that workout." };
  const supabase = await coachOnly();
  const { data: w } = await supabase.from("workouts").select("title, notes").eq("id", workoutId).maybeSingle();
  if (!w) return { error: "Workout not found." };
  const { data: created, error } = await supabase
    .from("workouts")
    .insert({ athlete_id: athleteId, group_id: null, workout_date: date, title: w.title, notes: w.notes })
    .select("id")
    .single();
  if (error) return { error: friendly(error.message) };
  const { data: items } = await supabase.from("workout_items").select("*").eq("workout_id", workoutId);
  if (items?.length) {
    const rows = items.map((it) => {
      const { id: _drop, created_at: _c, updated_at: _u, ...rest } = it as Record<string, unknown>;
      void _drop;
      void _c;
      void _u;
      return { ...rest, workout_id: created!.id };
    });
    const { error: e2 } = await supabase.from("workout_items").insert(rows);
    if (e2) return { error: friendly(e2.message) };
  }
  revalidatePath(`/coach/athlete/${athleteId}/program`);
  return {};
}

/** Start a program for this client on the day it was dropped. */
export async function assignProgramOn(athleteId: string, programId: string, start: string): Promise<Result> {
  if (!UUID.test(athleteId) || !UUID.test(programId) || !ISO_DATE.test(start)) return { error: "Couldn't start that program." };
  const supabase = await coachOnly();
  const { error } = await supabase.rpc("assign_program", {
    p_program: programId,
    p_athlete: athleteId,
    p_group: null,
    p_start: start,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/coach/athlete/${athleteId}/program`);
  return {};
}
