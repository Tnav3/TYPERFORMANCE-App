"use server";
// Workout logging. Each set/note saves on its own (TrainHeroic-style), so
// nothing is lost if the app is closed mid-session.
import { revalidatePath } from "next/cache";
import { todayISO } from "@/lib/dates";
import { friendly, signedIn, UUID } from "@/lib/programming/server";
import {
  DEFAULT_UNITS,
  fieldsFor,
  primaryValue,
  toCanonical,
  type FieldKey,
  type Units,
} from "@/lib/programming/fields";

type Result = { ok: true } | { ok: false; error: string };
type Ctx = Awaited<ReturnType<typeof signedIn>>;

async function ensureLog({ supabase, user }: Ctx, workoutId: string) {
  const { data } = await supabase
    .from("workout_logs")
    .select("id, completed_at, training_session_id, workout_date")
    .eq("workout_id", workoutId)
    .eq("athlete_id", user.id)
    .maybeSingle();
  if (data) return { log: data, error: null };
  const { data: created, error } = await supabase
    .from("workout_logs")
    .insert({ workout_id: workoutId, athlete_id: user.id })
    .select("id, completed_at, training_session_id, workout_date")
    .single();
  return { log: created, error: error?.message ?? null };
}

/**
 * Tick / untick / edit one set. `values` are what the client typed, in the
 * exercise's display units; they're converted to canonical units here.
 * Unticked sets are removed.
 */
export async function logSet(input: {
  workoutId: string;
  itemId: string;
  setNo: number;
  done: boolean;
  values?: Record<string, string>;
}): Promise<Result> {
  if (!UUID.test(input.workoutId) || !UUID.test(input.itemId)) return { ok: false, error: "Not found." };
  if (!Number.isInteger(input.setNo) || input.setNo < 1 || input.setNo > 30)
    return { ok: false, error: "Bad set number." };
  const ctx = await signedIn();
  const { log, error } = await ensureLog(ctx, input.workoutId);
  if (!log) return { ok: false, error: friendly(error ?? undefined) };

  if (!input.done) {
    const { error: e } = await ctx.supabase
      .from("set_logs")
      .delete()
      .eq("log_id", log.id)
      .eq("item_id", input.itemId)
      .eq("set_no", input.setNo);
    return e ? { ok: false, error: friendly(e.message) } : { ok: true };
  }
  const { data: item } = await ctx.supabase
    .from("workout_items")
    .select("exercises(measure, fields, weight_unit, distance_unit, speed_unit)")
    .eq("id", input.itemId)
    .maybeSingle();
  const ex = (item?.exercises ?? { measure: "load" }) as unknown as {
    measure: string;
    fields?: string[] | null;
  } & Partial<Units>;
  const units: Units = { ...DEFAULT_UNITS, ...Object.fromEntries(Object.entries(ex).filter(([k, v]) => k.endsWith("_unit") && v)) } as Units;
  const metrics: Partial<Record<FieldKey, number | null>> = {};
  let reps: number | null = null;
  let kg: number | null = null;
  for (const f of fieldsFor(ex)) {
    const v = toCanonical(f, String(input.values?.[f] ?? ""), units);
    if (f === "reps") reps = v == null ? null : Math.min(1000, v);
    else if (f === "weight") kg = v == null ? null : Math.min(600, v);
    else if (v != null) metrics[f] = Math.min(100000, v);
  }
  const { error: e } = await ctx.supabase.from("set_logs").upsert(
    {
      log_id: log.id,
      item_id: input.itemId,
      set_no: input.setNo,
      done: true,
      reps,
      load_kg: kg,
      value: primaryValue(metrics),
      metrics,
    },
    { onConflict: "log_id,item_id,set_no" },
  );
  return e ? { ok: false, error: friendly(e.message) } : { ok: true };
}

/** Exercise / text-block note and done tick. */
export async function saveItemLog(input: {
  workoutId: string;
  itemId: string;
  done?: boolean;
  comment?: string | null;
}): Promise<Result> {
  if (!UUID.test(input.workoutId) || !UUID.test(input.itemId)) return { ok: false, error: "Not found." };
  const ctx = await signedIn();
  const { log, error } = await ensureLog(ctx, input.workoutId);
  if (!log) return { ok: false, error: friendly(error ?? undefined) };
  const { data: cur } = await ctx.supabase
    .from("item_logs")
    .select("done, comment")
    .eq("log_id", log.id)
    .eq("item_id", input.itemId)
    .maybeSingle();
  const comment =
    input.comment === undefined ? cur?.comment ?? null : input.comment?.trim().slice(0, 500) || null;
  const done = input.done ?? cur?.done ?? false;
  const { error: e } = await ctx.supabase
    .from("item_logs")
    .upsert({ log_id: log.id, item_id: input.itemId, done, comment }, { onConflict: "log_id,item_id" });
  return e ? { ok: false, error: friendly(e.message) } : { ok: true };
}

export async function saveWorkoutComment(input: { workoutId: string; comment: string }): Promise<Result> {
  if (!UUID.test(input.workoutId)) return { ok: false, error: "Not found." };
  const ctx = await signedIn();
  const { log, error } = await ensureLog(ctx, input.workoutId);
  if (!log) return { ok: false, error: friendly(error ?? undefined) };
  const { error: e } = await ctx.supabase
    .from("workout_logs")
    .update({ comment: input.comment.trim().slice(0, 1000) || null })
    .eq("id", log.id);
  return e ? { ok: false, error: friendly(e.message) } : { ok: true };
}

export async function finishWorkout(input: {
  workoutId: string;
  rpe: number;
  duration: number;
  comment?: string;
}): Promise<Result> {
  if (!UUID.test(input.workoutId)) return { ok: false, error: "Not found." };
  if (!Number.isInteger(input.rpe) || input.rpe < 1 || input.rpe > 10)
    return { ok: false, error: "Pick how hard the whole session felt (RPE 1–10)." };
  if (!Number.isInteger(input.duration) || input.duration < 5 || input.duration > 360)
    return { ok: false, error: "Enter how long the session took (5–360 minutes)." };
  const ctx = await signedIn();
  const { log, error } = await ensureLog(ctx, input.workoutId);
  if (!log) return { ok: false, error: friendly(error ?? undefined) };
  const patch: Record<string, unknown> = {
    completed_at: log.completed_at ?? new Date().toISOString(),
    session_rpe: input.rpe,
    duration_min: input.duration,
  };
  if (input.comment !== undefined) patch.comment = input.comment.trim().slice(0, 1000) || null;
  const { error: e } = await ctx.supabase.from("workout_logs").update(patch).eq("id", log.id);
  if (e) return { ok: false, error: friendly(e.message) };
  await linkTrainingSession(ctx, log, input.rpe, input.duration);
  revalidatePath("/train");
  revalidatePath("/athlete");
  return { ok: true };
}

export async function reopenWorkout(input: { workoutId: string }): Promise<Result> {
  if (!UUID.test(input.workoutId)) return { ok: false, error: "Not found." };
  const { supabase, user } = await signedIn();
  const { error } = await supabase
    .from("workout_logs")
    .update({ completed_at: null })
    .eq("workout_id", input.workoutId)
    .eq("athlete_id", user.id);
  revalidatePath("/train");
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

/** Feed the weekly training load (S&C → Strength) so nothing is entered twice. */
async function linkTrainingSession(
  { supabase, user }: Ctx,
  log: { id: string; training_session_id: string | null; workout_date: string },
  rpe: number,
  duration: number,
) {
  const { data: me } = await supabase.from("profiles").select("feat_checkin").eq("id", user.id).single();
  if (me?.feat_checkin === false) return;
  if (log.training_session_id) {
    await supabase
      .from("training_sessions")
      .update({ rpe, duration_min: duration })
      .eq("id", log.training_session_id);
    return;
  }
  const { data: type } = await supabase
    .from("session_types")
    .select("id, discipline_id, disciplines!inner(name)")
    .eq("disciplines.name", "S&C")
    .eq("name", "Strength")
    .maybeSingle();
  if (!type) return;
  const today = todayISO();
  const date = log.workout_date > today ? today : log.workout_date;
  const now = new Date().toLocaleTimeString("en-GB", {
    timeZone: "Australia/Sydney",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const { data: session } = await supabase
    .from("training_sessions")
    .insert({
      athlete_id: user.id,
      session_date: date,
      start_time: now,
      duration_min: duration,
      discipline_id: type.discipline_id,
      session_type_id: type.id,
      rpe,
      notes: "Logged from your program",
    })
    .select("id")
    .single();
  if (session)
    await supabase.from("workout_logs").update({ training_session_id: session.id }).eq("id", log.id);
}

/** Today's readiness check (one per day; answering again replaces it). */
export async function saveReadiness(input: {
  sleep: number;
  energy: number;
  soreness: number;
  stress: number;
  motivation: number;
  sleepHours?: number | null;
}): Promise<Result> {
  const vals = [input.sleep, input.energy, input.soreness, input.stress, input.motivation];
  if (!vals.every((v) => Number.isInteger(v) && v >= 1 && v <= 5)) return { ok: false, error: "Answer each question." };
  const hours = input.sleepHours == null || Number.isNaN(input.sleepHours) ? null : Math.min(16, Math.max(0, Math.round(input.sleepHours * 2) / 2));
  const { supabase, user } = await signedIn();
  const { error } = await supabase.from("readiness").upsert(
    {
      athlete_id: user.id,
      checked_on: todayISO(),
      sleep: input.sleep,
      energy: input.energy,
      soreness: input.soreness,
      stress: input.stress,
      motivation: input.motivation,
      sleep_hours: hours,
    },
    { onConflict: "athlete_id,checked_on" },
  );
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}
