"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { todayISO } from "@/lib/dates";
import { friendly, int, signedIn, str, UUID } from "@/lib/programming/server";

const num = (v: FormDataEntryValue | null, max: number) => {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};

function back(id: string, error?: string, extra = ""): never {
  revalidatePath(`/train/${id}`);
  revalidatePath("/train");
  revalidatePath("/athlete");
  redirect(
    error
      ? `/train/${id}?error=${encodeURIComponent(error)}`
      : `/train/${id}${extra}`,
  );
}

/**
 * Saves everything on the workout screen in one go.
 * Fields: s:<item>:<set>:{done,reps,kg,val} · d:<item> (block done) · c:<item> (comment)
 *         comment · finish=1 with rpe + duration
 */
export async function saveWorkoutLog(fd: FormData) {
  const { supabase, user } = await signedIn();
  const workoutId = String(fd.get("workout_id") ?? "");
  if (!UUID.test(workoutId)) redirect("/train");
  const finish = fd.get("finish") === "1";
  const rpe = int(fd.get("rpe"));
  const duration = int(fd.get("duration"));
  if (finish && (!rpe || rpe < 1 || rpe > 10))
    back(workoutId, "Pick how hard the whole session felt (RPE 1–10).");
  if (finish && (!duration || duration < 5 || duration > 360))
    back(workoutId, "Enter how long the session took (5–360 minutes).");

  // Items that really belong to this workout (RLS hides others)
  const { data: items } = await supabase
    .from("workout_items")
    .select("id, kind")
    .eq("workout_id", workoutId);
  const itemIds = new Set((items ?? []).map((i) => i.id));
  if (!itemIds.size && !(items ?? []).length) {
    // An empty workout can still be finished (e.g. a notes-only day)
  }

  // Find or create the log
  let { data: log } = await supabase
    .from("workout_logs")
    .select("id, completed_at, training_session_id, workout_date")
    .eq("workout_id", workoutId)
    .eq("athlete_id", user.id)
    .maybeSingle();
  if (!log) {
    const { data, error } = await supabase
      .from("workout_logs")
      .insert({ workout_id: workoutId, athlete_id: user.id })
      .select("id, completed_at, training_session_id, workout_date")
      .single();
    if (error) back(workoutId, friendly(error.message));
    log = data;
  }
  const logId = log!.id;

  // Sets
  const sets: Record<string, Record<string, unknown>> = {};
  const itemDone = new Map<string, boolean>();
  const comments = new Map<string, string | null>();
  for (const [k, v] of fd.entries()) {
    const sm = k.match(/^s:([0-9a-f-]{36}):(\d{1,2}):(done|reps|kg|val)$/i);
    if (sm && itemIds.has(sm[1])) {
      const key = `${sm[1]}:${sm[2]}`;
      sets[key] ??= { log_id: logId, item_id: sm[1], set_no: Number(sm[2]), done: false };
      if (sm[3] === "done") sets[key].done = v === "on";
      if (sm[3] === "reps") sets[key].reps = num(v, 1000) !== null ? Math.round(num(v, 1000)!) : null;
      if (sm[3] === "kg") sets[key].load_kg = num(v, 600);
      if (sm[3] === "val") sets[key].value = num(v, 100000);
      continue;
    }
    const dm = k.match(/^d:([0-9a-f-]{36})$/i);
    if (dm && itemIds.has(dm[1])) itemDone.set(dm[1], v === "on");
    const cm = k.match(/^c:([0-9a-f-]{36})$/i);
    if (cm && itemIds.has(cm[1])) comments.set(cm[1], str(v, 500));
  }
  // Only ticked sets are kept
  const keep = Object.values(sets)
    .filter((s) => s.done && Number(s.set_no) >= 1 && Number(s.set_no) <= 30)
    .map((s) => ({ reps: null, load_kg: null, value: null, ...s }) as Record<string, unknown>);
  const { error: delErr } = await supabase.from("set_logs").delete().eq("log_id", logId);
  if (delErr) back(workoutId, friendly(delErr.message));
  if (keep.length) {
    const { error } = await supabase.from("set_logs").insert(keep);
    if (error) back(workoutId, friendly(error.message));
  }

  // Per-item ticks and comments (an exercise counts as done if any set is ticked)
  const setDone = new Set(keep.map((s) => String(s.item_id)));
  const itemRows = [...itemIds]
    .map((id) => ({
      log_id: logId,
      item_id: id,
      done: itemDone.get(id) ?? setDone.has(id),
      comment: comments.get(id) ?? null,
    }))
    .filter((r) => r.done || r.comment);
  await supabase.from("item_logs").delete().eq("log_id", logId);
  if (itemRows.length) {
    const { error } = await supabase.from("item_logs").insert(itemRows);
    if (error) back(workoutId, friendly(error.message));
  }

  // Workout comment / finish
  const patch: Record<string, unknown> = { comment: str(fd.get("comment"), 1000) };
  if (finish) {
    patch.completed_at = log!.completed_at ?? new Date().toISOString();
    patch.session_rpe = rpe;
    patch.duration_min = duration;
  }
  const { error: upErr } = await supabase.from("workout_logs").update(patch).eq("id", logId);
  if (upErr) back(workoutId, friendly(upErr.message));

  // Feed the weekly training load (S&C → Strength) so nothing is entered twice
  if (finish) await linkTrainingSession(supabase, user.id, logId, log!, rpe!, duration!);

  back(workoutId, undefined, finish ? "?done=1" : "?saved=1");
}

async function linkTrainingSession(
  supabase: Awaited<ReturnType<typeof signedIn>>["supabase"],
  userId: string,
  logId: string,
  log: { training_session_id: string | null; workout_date: string },
  rpe: number,
  duration: number,
) {
  const { data: me } = await supabase
    .from("profiles")
    .select("feat_checkin")
    .eq("id", userId)
    .single();
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
      athlete_id: userId,
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
    await supabase.from("workout_logs").update({ training_session_id: session.id }).eq("id", logId);
}

/** Undo "finished" so the client can keep editing (keeps sets). */
export async function reopenWorkout(fd: FormData) {
  const { supabase, user } = await signedIn();
  const workoutId = String(fd.get("workout_id") ?? "");
  if (!UUID.test(workoutId)) redirect("/train");
  const { error } = await supabase
    .from("workout_logs")
    .update({ completed_at: null })
    .eq("workout_id", workoutId)
    .eq("athlete_id", user.id);
  back(workoutId, error ? friendly(error.message) : undefined);
}
