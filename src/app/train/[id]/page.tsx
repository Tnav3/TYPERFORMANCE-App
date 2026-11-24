import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { editableFrom } from "@/lib/week";
import { getLifts, getMaxes, latestBodyweight } from "@/lib/lift-data";
import { RPE_LABELS } from "@/lib/scales";
import { formatPrescription, formatRest, itemLabel, setCount, targetReps } from "@/lib/prescription";
import { baseFor, latestByLift, lineLoad } from "@/lib/programming/loads";
import {
  byBlock,
  ITEM_COLUMNS,
  type Exercise,
  type ItemFields,
  type ItemLog,
  type SetLog,
  type Workout,
  type WorkoutLog,
} from "@/lib/programming/types";
import { ExerciseVideo } from "@/components/ExerciseVideo";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";
import { reopenWorkout, saveWorkoutLog } from "../actions";

export const dynamic = "force-dynamic";

const cell =
  "min-h-11 w-full min-w-0 rounded-lg border border-line bg-surface-2 px-2 text-center text-text focus:border-brand focus:outline-none";
const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const UNIT: Record<string, string> = { time: "sec", distance: "m", calories: "cal" };

export default async function WorkoutLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; done?: string }>;
}) {
  const { supabase, user, state } = await requireFeature(["athlete", "coach"], "program");
  const { id } = await params;
  if (state === "coach") redirect(`/coach/workouts/${id}`);
  const sp = await searchParams;

  const { data: workout } = await supabase.from("workouts").select("*").eq("id", id).maybeSingle<Workout>();
  if (!workout) notFound();
  const [{ data: itemRows }, { data: log }, lifts, maxes, bodyweight] = await Promise.all([
    supabase.from("workout_items").select(ITEM_COLUMNS).eq("workout_id", id).order("position"),
    supabase.from("workout_logs").select("*").eq("workout_id", id).eq("athlete_id", user!.id).maybeSingle<WorkoutLog>(),
    getLifts(supabase),
    getMaxes(supabase, user!.id),
    latestBodyweight(supabase, user!.id),
  ]);
  const items = (itemRows ?? []) as unknown as ItemFields[];
  const exIds = [...new Set(items.map((i) => i.exercise_id).filter(Boolean))] as string[];
  const [{ data: exRows }, { data: setRows }, { data: itemLogRows }, { data: lastRows }] = await Promise.all([
    exIds.length
      ? supabase.from("exercises").select("*").in("id", exIds)
      : Promise.resolve({ data: [] }),
    log ? supabase.from("set_logs").select("*").eq("log_id", log.id) : Promise.resolve({ data: [] }),
    log ? supabase.from("item_logs").select("*").eq("log_id", log.id) : Promise.resolve({ data: [] }),
    exIds.length
      ? supabase
          .from("set_logs")
          .select("reps, load_kg, value, workout_items!inner(exercise_id, workout_id), workout_logs!inner(workout_date, athlete_id)")
          .eq("workout_logs.athlete_id", user!.id)
          .in("workout_items.exercise_id", exIds)
          .neq("workout_items.workout_id", id)
          .order("workout_date", { referencedTable: "workout_logs", ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] }),
  ]);
  const exercises = new Map(((exRows ?? []) as Exercise[]).map((e) => [e.id, e]));
  const liftMap = new Map(lifts.map((l) => [l.key, l]));
  const latest = latestByLift(maxes);
  const sets = (setRows ?? []) as SetLog[];
  const itemLogs = new Map(((itemLogRows ?? []) as ItemLog[]).map((l) => [l.item_id, l]));

  // Most recent previous session per exercise: "5 × 100 kg, 5 × 100 kg…"
  const last = new Map<string, { date: string; sets: { reps: number | null; kg: number | null; value: number | null }[] }>();
  for (const r of (lastRows ?? []) as unknown as {
    reps: number | null;
    load_kg: string | null;
    value: string | null;
    workout_items: { exercise_id: string };
    workout_logs: { workout_date: string };
  }[]) {
    const ex = r.workout_items.exercise_id;
    const date = r.workout_logs.workout_date;
    const cur = last.get(ex);
    if (cur && cur.date !== date) continue;
    const entry = { reps: r.reps, kg: r.load_kg == null ? null : Number(r.load_kg), value: r.value == null ? null : Number(r.value) };
    if (cur) cur.sets.push(entry);
    else last.set(ex, { date, sets: [entry] });
  }

  const today = todayISO();
  const locked = workout.workout_date < editableFrom(today);
  const early = workout.workout_date > today;
  const finished = !!log?.completed_at;
  const blocks = byBlock(items);

  return (
    <Screen>
      <BackLink href="/train" label="Training" />
      <Heading sub={formatDate(workout.workout_date)}>{workout.title}</Heading>
      {sp.error && <Alert>{sp.error}</Alert>}
      {sp.saved && <Alert tone="ok">Saved. Finish when you&apos;re done.</Alert>}
      {sp.done && <Alert tone="ok">Workout logged. Nice work.</Alert>}
      {locked && <Alert tone="info">This week is locked (older than 4 weeks), so it&apos;s view only.</Alert>}
      {early && !locked && (
        <Alert tone="info">This is for {formatDate(workout.workout_date)}. You can log it from the day before.</Alert>
      )}
      {workout.notes && <p className="mb-4 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{workout.notes}</p>}

      <form action={saveWorkoutLog}>
        <input type="hidden" name="workout_id" value={workout.id} />
        <fieldset disabled={locked || (early && workout.workout_date > todayPlusOne(today))} className="space-y-4">
          {blocks.map(([letter, list]) => (
            <section key={letter} className="rounded-2xl border border-line bg-surface p-3">
              {list.length > 1 && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">
                  Superset {letter}: alternate between these
                </p>
              )}
              <div className="space-y-4">
                {list.map((it) => {
                  const ex = it.exercise_id ? exercises.get(it.exercise_id) : null;
                  const il = itemLogs.get(it.id);
                  if (it.kind === "text" || !ex)
                    return (
                      <div key={it.id}>
                        <p className="font-black uppercase tracking-tight">
                          <span className="mr-2 text-brand">{itemLabel(it, list.length)}</span>
                          {it.title ?? "Notes"}
                        </p>
                        {it.notes && <p className="mt-1 whitespace-pre-line text-sm text-muted">{it.notes}</p>}
                        <label className="mt-2 flex min-h-11 items-center gap-3 text-sm">
                          <input type="checkbox" name={`d:${it.id}`} defaultChecked={il?.done} className="h-6 w-6 accent-[var(--color-brand)]" />
                          Done
                        </label>
                        <Comment id={it.id} value={il?.comment} />
                      </div>
                    );

                  const base = baseFor(ex.lift_key, liftMap, latest);
                  const load = lineLoad(it, base, bodyweight);
                  const n = setCount(it.sets);
                  const logged = sets.filter((s) => s.item_id === it.id);
                  const rows = Math.max(n, ...logged.map((s) => s.set_no));
                  const measure = ex.measure;
                  const prev = last.get(ex.id);
                  const rx = formatPrescription({
                    ...it,
                    percent: it.percent != null ? Number(it.percent) : null,
                    rpe: it.rpe != null ? Number(it.rpe) : null,
                    load_kg: it.load_kg != null ? Number(it.load_kg) : null,
                    rest_sec: null,
                    tempo: null,
                  });
                  return (
                    <div key={it.id}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-black uppercase tracking-tight">
                          <span className="mr-2 text-brand">{itemLabel(it, list.length)}</span>
                          <Link href={`/train/history/${ex.id}`} className="hover:underline">{ex.name}</Link>
                        </p>
                        {load && (
                          <span className="shrink-0 rounded-full bg-brand/15 px-2.5 py-1 text-sm font-black text-brand">
                            {load.addedToBodyweight ? `+${load.kg}` : `~${load.kg}`} kg
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted">
                        {rx || "As prescribed"}
                        {it.tempo && ` · tempo ${it.tempo}`}
                        {it.rest_sec ? ` · rest ${formatRest(it.rest_sec)}` : ""}
                      </p>
                      {it.load_type === "percent" && !base && (
                        <p className="text-xs text-warn">Save a 1RM in the calculator to see your load.</p>
                      )}
                      {it.notes && <p className="mt-1 text-sm">{it.notes}</p>}
                      {ex.cues && (
                        <details className="mt-1 text-sm">
                          <summary className="cursor-pointer text-muted">Coaching cues</summary>
                          <p className="mt-1 whitespace-pre-line">{ex.cues}</p>
                        </details>
                      )}
                      <ExerciseVideo url={ex.video_url} name={ex.name} />
                      {prev && (
                        <p className="text-xs text-muted">
                          Last time ({formatDate(prev.date)}):{" "}
                          {prev.sets
                            .map((s) =>
                              measure === "time" || measure === "distance" || measure === "calories"
                                ? `${s.value ?? "?"} ${UNIT[measure]}`
                                : `${s.reps ?? "?"}${s.kg != null ? ` × ${s.kg} kg` : ""}`,
                            )
                            .join(", ")}
                        </p>
                      )}

                      <div className="mt-2 grid grid-cols-[2rem_1fr_1fr_2.75rem] items-center gap-2 text-xs text-muted">
                        <span>Set</span>
                        {measure === "time" || measure === "distance" || measure === "calories" ? (
                          <>
                            <span className="col-span-2 text-center">{UNIT[measure]}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-center">Reps</span>
                            <span className="text-center">{measure === "bodyweight" ? "+kg" : "kg"}</span>
                          </>
                        )}
                        <span className="text-center">Done</span>
                        {Array.from({ length: rows }, (_, k) => {
                          const no = k + 1;
                          const s = logged.find((x) => x.set_no === no);
                          const timed = measure === "time" || measure === "distance" || measure === "calories";
                          return (
                            <SetRow
                              key={no}
                              name={`s:${it.id}:${no}`}
                              no={no}
                              timed={timed}
                              reps={s?.reps ?? targetReps(it.reps)}
                              kg={s ? (s.load_kg != null ? Number(s.load_kg) : null) : load?.kg ?? null}
                              value={s?.value != null ? Number(s.value) : timed ? targetReps(it.reps) : null}
                              done={!!s?.done}
                              showKg={measure !== "bodyweight" || load?.addedToBodyweight || s?.load_kg != null || true}
                            />
                          );
                        })}
                      </div>
                      <Comment id={it.id} value={il?.comment} />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {items.length === 0 && <p className="text-muted">Nothing prescribed for this day.</p>}

          <label className="block">
            <span className="mb-1 block text-sm font-semibold">How did it go? (your coach sees this)</span>
            <textarea name="comment" defaultValue={log?.comment ?? ""} rows={3} maxLength={1000} className={`${input} py-2`} />
          </label>

          <button name="finish" value="0" className="min-h-12 w-full rounded-xl border border-line bg-surface-2 font-extrabold uppercase tracking-wide">
            Save progress
          </button>

          <div className="rounded-2xl border border-brand/50 bg-surface p-4">
            <p className="mb-3 font-extrabold">{finished ? "Finished: update if needed" : "Finish workout"}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                <span className="mb-1 block text-muted">Session RPE</span>
                <select name="rpe" defaultValue={log?.session_rpe ?? ""} className={input}>
                  <option value="">Pick…</option>
                  {Array.from({ length: 10 }, (_, k) => 10 - k).map((r) => (
                    <option key={r} value={r}>
                      {r}: {RPE_LABELS[r]?.label ?? ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Minutes</span>
                <input name="duration" type="number" inputMode="numeric" min={5} max={360} defaultValue={log?.duration_min ?? ""} className={input} />
              </label>
            </div>
            <button name="finish" value="1" className="mt-3 min-h-12 w-full rounded-xl bg-brand font-extrabold uppercase tracking-wide text-white">
              {finished ? "Update" : "Finish"}
            </button>
          </div>
        </fieldset>
      </form>
      {finished && !locked && (
        <form action={reopenWorkout} className="mt-3 text-center">
          <input type="hidden" name="workout_id" value={workout.id} />
          <button className="text-sm text-muted underline underline-offset-4">Mark as not finished</button>
        </form>
      )}
    </Screen>
  );
}

function todayPlusOne(today: string) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function SetRow({
  name,
  no,
  timed,
  reps,
  kg,
  value,
  done,
}: {
  name: string;
  no: number;
  timed: boolean;
  reps: number | null;
  kg: number | null;
  value: number | null;
  done: boolean;
  showKg?: boolean;
}) {
  return (
    <>
      <span className="text-center font-bold text-text">{no}</span>
      {timed ? (
        <input name={`${name}:val`} inputMode="decimal" defaultValue={value ?? ""} className={`${cell} col-span-2`} aria-label={`Set ${no} amount`} />
      ) : (
        <>
          <input name={`${name}:reps`} inputMode="numeric" defaultValue={reps ?? ""} className={cell} aria-label={`Set ${no} reps`} />
          <input name={`${name}:kg`} inputMode="decimal" defaultValue={kg ?? ""} className={cell} aria-label={`Set ${no} kg`} />
        </>
      )}
      <input type="checkbox" name={`${name}:done`} defaultChecked={done} className="mx-auto h-7 w-7 accent-[var(--color-brand)]" aria-label={`Set ${no} done`} />
    </>
  );
}

function Comment({ id, value }: { id: string; value: string | null | undefined }) {
  return (
    <details className="mt-2" open={!!value}>
      <summary className="cursor-pointer text-sm text-muted">{value ? "Your note" : "+ Add a note for your coach"}</summary>
      <textarea
        name={`c:${id}`}
        defaultValue={value ?? ""}
        rows={2}
        maxLength={500}
        className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-text focus:border-brand focus:outline-none"
        aria-label="Note for your coach"
      />
    </details>
  );
}
