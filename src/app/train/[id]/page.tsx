import { notFound, redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { addDays, editableFrom } from "@/lib/week";
import { getLifts, getMaxes, latestBodyweight } from "@/lib/lift-data";
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
import { WorkoutLogger, type LoggerBlock, type LoggerItem } from "@/components/WorkoutLogger";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

const UNIT: Record<string, string> = { time: "sec", distance: "m", calories: "cal", load: "", bodyweight: "" };

export default async function WorkoutLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase, user, state } = await requireFeature(["athlete", "coach"], "program");
  const { id } = await params;
  if (state === "coach") redirect(`/coach/workouts/${id}`);

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
  const early = workout.workout_date > addDays(today, 1);
  const finished = !!log?.completed_at;

  const blocks: LoggerBlock[] = byBlock(items).map(([letter, list]) => ({
    letter,
    superset: list.length > 1,
    items: list.map((it): LoggerItem => {
      const ex = it.exercise_id ? exercises.get(it.exercise_id) : null;
      const il = itemLogs.get(it.id);
      const label = itemLabel(it, list.length);
      if (it.kind === "text" || !ex)
        return {
          id: it.id, kind: "text", label, name: it.title ?? "Notes", exerciseId: null, rx: "", meta: "",
          notes: it.notes, cues: null, videoUrl: null, loadChip: null, warn: null, prev: null,
          measure: "load", restSec: null, sets: [], comment: il?.comment ?? "", done: !!il?.done,
        };
      const base = baseFor(ex.lift_key, liftMap, latest);
      const load = lineLoad(it, base, bodyweight);
      const logged = sets.filter((x) => x.item_id === it.id);
      const rows = Math.max(setCount(it.sets), ...logged.map((x) => x.set_no));
      const timed = ex.measure === "time" || ex.measure === "distance" || ex.measure === "calories";
      const prev = last.get(ex.id);
      return {
        id: it.id,
        kind: "exercise",
        label,
        name: ex.name,
        exerciseId: ex.id,
        rx:
          formatPrescription({
            ...it,
            percent: it.percent != null ? Number(it.percent) : null,
            rpe: it.rpe != null ? Number(it.rpe) : null,
            load_kg: it.load_kg != null ? Number(it.load_kg) : null,
            rest_sec: null,
            tempo: null,
          }) || "As prescribed",
        meta: [it.tempo && `tempo ${it.tempo}`, it.rest_sec ? `rest ${formatRest(it.rest_sec)}` : null].filter(Boolean).join(" · "),
        notes: it.notes,
        cues: ex.cues,
        videoUrl: ex.video_url,
        loadChip: load ? `${load.addedToBodyweight ? "+" : "~"}${load.kg} kg` : null,
        warn:
          it.load_type === "percent" && !base
            ? "Save a 1RM in the calculator to see your load."
            : it.load_type === "percent" && base?.bodyweightLift && bodyweight == null
              ? "Add your bodyweight in a check-in to see your load."
              : null,
        prev: prev
          ? `${formatDate(prev.date)}: ` +
            prev.sets
              .map((x) => (timed ? `${x.value ?? "?"} ${UNIT[ex.measure]}` : `${x.reps ?? "?"}${x.kg != null ? ` × ${x.kg} kg` : ""}`))
              .join(", ")
          : null,
        measure: ex.measure,
        restSec: it.rest_sec,
        sets: Array.from({ length: rows }, (_, k) => {
          const no = k + 1;
          const x = logged.find((y) => y.set_no === no);
          const target = targetReps(it.reps);
          return {
            setNo: no,
            reps: String(x?.reps ?? (timed ? "" : target ?? "")),
            kg: String(x ? (x.load_kg != null ? Number(x.load_kg) : "") : (load?.kg ?? "")),
            value: String(x?.value != null ? Number(x.value) : timed ? (target ?? "") : ""),
            done: !!x?.done,
          };
        }),
        comment: il?.comment ?? "",
        done: !!il?.done,
      };
    }),
  }));

  return (
    <Screen>
      <BackLink href="/train" label="Training" />
      <Heading sub={formatDate(workout.workout_date)}>{workout.title}</Heading>
      {locked && <Alert tone="info">This week is locked (older than 4 weeks), so it&apos;s view only.</Alert>}
      {early && <Alert tone="info">This is for {formatDate(workout.workout_date)}. You can log it from the day before.</Alert>}
      {workout.notes && <p className="mb-4 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{workout.notes}</p>}
      {items.length === 0 && <p className="text-muted">Nothing prescribed for this day.</p>}
      <WorkoutLogger
        workoutId={workout.id}
        blocks={blocks}
        comment={log?.comment ?? ""}
        finished={finished}
        rpe={log?.session_rpe ?? null}
        duration={log?.duration_min ?? null}
        readOnly={locked || early}
      />
    </Screen>
  );
}
