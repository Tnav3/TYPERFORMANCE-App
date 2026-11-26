"use server";
import { SWAP_REASONS } from "@/lib/programming/types";
const SWAP_KEYS: string[] = SWAP_REASONS.map((r) => r[0]);
// Workout logging. Each set/note saves on its own (TrainHeroic-style), so
// nothing is lost if the app is closed mid-session.
import { revalidatePath } from "next/cache";
import { todayISO } from "@/lib/dates";
import { friendly, signedIn, UUID } from "@/lib/programming/server";
import { DEFAULT_STALE_WEEKS, isStale, repMaxEquivalent } from "@/lib/programming/stale-max";
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

/** Whose log this is: the client themselves, or a client their coach is logging for. */
function whoFor(ctx: Ctx, athleteId?: string) {
  return athleteId && ctx.isCoach && UUID.test(athleteId) ? athleteId : ctx.user.id;
}

async function ensureLog({ supabase }: Ctx, workoutId: string, who: string) {
  const { data } = await supabase
    .from("workout_logs")
    .select("id, completed_at, training_session_id, workout_date")
    .eq("workout_id", workoutId)
    .eq("athlete_id", who)
    .maybeSingle();
  if (data) return { log: data, error: null };
  const { data: created, error } = await supabase
    .from("workout_logs")
    .insert({ workout_id: workoutId, athlete_id: who })
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
  athleteId?: string;
  itemId: string;
  setNo: number;
  done: boolean;
  values?: Record<string, string>;
}): Promise<Result> {
  if (!UUID.test(input.workoutId) || !UUID.test(input.itemId)) return { ok: false, error: "Not found." };
  if (!Number.isInteger(input.setNo) || input.setNo < 1 || input.setNo > 30)
    return { ok: false, error: "Bad set number." };
  const ctx = await signedIn();
  const { log, error } = await ensureLog(ctx, input.workoutId, whoFor(ctx, input.athleteId));
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
    .select("fields, exercises(measure, fields, weight_unit, distance_unit, speed_unit)")
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
  for (const f of fieldsFor(ex, item as { fields?: string[] | null } | null)) {
    const v = toCanonical(f, String(input.values?.[f] ?? ""), units);
    if (f === "reps") reps = v == null ? null : Math.min(1000, v);
    else if (f === "weight") kg = v == null ? null : Math.min(600, v);
    else if (v != null) metrics[f] = Math.min(100000, v);
  }
  const rpeIn = Number(String(input.values?.rpe ?? "").replace(",", "."));
  if (metrics.rpe == null && rpeIn >= 1 && rpeIn <= 10) metrics.rpe = rpeIn;
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
  if (e) return { ok: false, error: friendly(e.message) };
  const rpeRaw = Number(String(input.values?.rpe ?? "").replace(",", "."));
  if (reps && kg && Number.isFinite(rpeRaw) && rpeRaw > 0) {
    try {
      await refreshStaleMax(ctx, whoFor(ctx, input.athleteId), log.id, input.itemId, reps, kg, rpeRaw);
    } catch {
      /* best effort: the set itself is saved */
    }
  }
  return { ok: true };
}

/**
 * Back on a lift after a break: a logged top set with an RPE saves a fresh e1RM when the
 * saved one is older than the coach's cut-off (or there isn't one). Barbell lifts only.
 * One per lift per day; a better set that day replaces it.
 */
async function refreshStaleMax(ctx: Ctx, who: string, logId: string, itemId: string, reps: number, kg: number, rpe: number) {
  const repMax = repMaxEquivalent(reps, rpe);
  if (!repMax) return;
  const db = ctx.supabase;
  const [{ data: item }, { data: il }] = await Promise.all([
    db.from("workout_items").select("exercises(lift_key)").eq("id", itemId).maybeSingle(),
    db.from("item_logs").select("swap_exercise_id").eq("log_id", logId).eq("item_id", itemId).maybeSingle(),
  ]);
  let liftKey = (item?.exercises as unknown as { lift_key: string | null } | null)?.lift_key ?? null;
  if (il?.swap_exercise_id) {
    const { data: sw } = await db.from("exercises").select("lift_key").eq("id", il.swap_exercise_id).maybeSingle();
    liftKey = sw?.lift_key ?? null;
  }
  if (!liftKey) return;
  const { data: lift } = await db.from("lifts").select("kind").eq("key", liftKey).maybeSingle();
  if (lift?.kind !== "barbell") return;
  const [{ data: last }, { data: settings }] = await Promise.all([
    db.from("lift_maxes").select("id, saved_on, source, e1rm_kg").eq("athlete_id", who).eq("lift_key", liftKey).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("app_settings").select("stale_max_weeks").maybeSingle(),
  ]);
  const today = todayISO();
  const fromToday = last?.source === "session" && last.saved_on === today;
  if (last && !fromToday && !isStale(last.saved_on, today, settings?.stale_max_weeks ?? DEFAULT_STALE_WEEKS)) return;
  const { data: est } = await db.rpc("e1rm", { load: kg, reps: repMax });
  if (fromToday) {
    if (est != null && Number(est) <= Number(last!.e1rm_kg)) return;
    await db.from("lift_maxes").delete().eq("id", last!.id);
  }
  await db.from("lift_maxes").insert({ athlete_id: who, lift_key: liftKey, load_kg: kg, reps: repMax, source: "session", saved_on: today });
}

/** Exercise / text-block note and done tick. */
export async function saveItemLog(input: {
  workoutId: string;
  athleteId?: string;
  itemId: string;
  done?: boolean;
  comment?: string | null;
}): Promise<Result> {
  if (!UUID.test(input.workoutId) || !UUID.test(input.itemId)) return { ok: false, error: "Not found." };
  const ctx = await signedIn();
  const { log, error } = await ensureLog(ctx, input.workoutId, whoFor(ctx, input.athleteId));
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

/** Swap the programmed exercise for another (or undo with exerciseId null). Sets already logged move with it. */
export async function swapExercise(input: {
  workoutId: string;
  athleteId?: string;
  itemId: string;
  exerciseId: string | null;
  reason?: string | null;
  note?: string | null;
}): Promise<Result> {
  if (!UUID.test(input.workoutId) || !UUID.test(input.itemId) || (input.exerciseId && !UUID.test(input.exerciseId))) return { ok: false, error: "Not found." };
  const reason = input.exerciseId && SWAP_KEYS.includes(input.reason ?? "") ? input.reason! : null;
  if (input.exerciseId && !reason) return { ok: false, error: "Pick a reason for the swap." };
  const ctx = await signedIn();
  const { log, error } = await ensureLog(ctx, input.workoutId, whoFor(ctx, input.athleteId));
  if (!log) return { ok: false, error: friendly(error ?? undefined) };
  const { error: e } = await ctx.supabase.from("item_logs").upsert(
    {
      log_id: log.id,
      item_id: input.itemId,
      swap_exercise_id: input.exerciseId,
      swap_reason: reason,
      swap_note: input.exerciseId ? input.note?.trim().slice(0, 300) || null : null,
      swapped_at: input.exerciseId ? new Date().toISOString() : null,
    },
    { onConflict: "log_id,item_id" },
  );
  return e ? { ok: false, error: friendly(e.message) } : { ok: true };
}

export async function saveWorkoutComment(input: { workoutId: string; comment: string; athleteId?: string }): Promise<Result> {
  if (!UUID.test(input.workoutId)) return { ok: false, error: "Not found." };
  const ctx = await signedIn();
  const { log, error } = await ensureLog(ctx, input.workoutId, whoFor(ctx, input.athleteId));
  if (!log) return { ok: false, error: friendly(error ?? undefined) };
  const { error: e } = await ctx.supabase
    .from("workout_logs")
    .update({ comment: input.comment.trim().slice(0, 1000) || null })
    .eq("id", log.id);
  return e ? { ok: false, error: friendly(e.message) } : { ok: true };
}

export async function finishWorkout(input: {
  workoutId: string;
  athleteId?: string;
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
  const { log, error } = await ensureLog(ctx, input.workoutId, whoFor(ctx, input.athleteId));
  if (!log) return { ok: false, error: friendly(error ?? undefined) };
  const patch: Record<string, unknown> = {
    completed_at: log.completed_at ?? new Date().toISOString(),
    session_rpe: input.rpe,
    duration_min: input.duration,
  };
  if (input.comment !== undefined) patch.comment = input.comment.trim().slice(0, 1000) || null;
  const { error: e } = await ctx.supabase.from("workout_logs").update(patch).eq("id", log.id);
  if (e) return { ok: false, error: friendly(e.message) };
  await linkTrainingSession(ctx, whoFor(ctx, input.athleteId), log, input.rpe, input.duration);
  revalidatePath("/train");
  revalidatePath("/athlete");
  return { ok: true };
}

export async function reopenWorkout(input: { workoutId: string; athleteId?: string }): Promise<Result> {
  if (!UUID.test(input.workoutId)) return { ok: false, error: "Not found." };
  const ctx = await signedIn();
  const { error } = await ctx.supabase
    .from("workout_logs")
    .update({ completed_at: null })
    .eq("workout_id", input.workoutId)
    .eq("athlete_id", whoFor(ctx, input.athleteId));
  revalidatePath("/train");
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

/** Feed the weekly training load (S&C → Strength) so nothing is entered twice. */
async function linkTrainingSession(
  { supabase }: Ctx,
  who: string,
  log: { id: string; training_session_id: string | null; workout_date: string },
  rpe: number,
  duration: number,
) {
  const { data: me } = await supabase.from("profiles").select("feat_checkin").eq("id", who).single();
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
      athlete_id: who,
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
