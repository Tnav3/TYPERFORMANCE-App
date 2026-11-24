// Builds everything the workout logger needs for one workout and one athlete.
// Used by the client's workout screen and the coach's Train together view.
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate, todayISO } from "@/lib/dates";
import { addDays, editableFrom } from "@/lib/week";
import { getLifts, getMaxes, latestBodyweight } from "@/lib/lift-data";
import { formatPrescription, formatRest, itemLabel, setCount, targetReps } from "@/lib/prescription";
import { baseFor, latestByLift, lineLoad } from "@/lib/programming/loads";
import {
  DEFAULT_UNITS,
  describeSet,
  fieldsFor,
  fromCanonical,
  suggestedDisplayWeight,
  unitLabel,
  type Units,
} from "@/lib/programming/fields";
import {
  blockTitle,
  byBlock,
  ITEM_COLUMNS,
  type Exercise,
  type ItemFields,
  type ItemLog,
  type SetLog,
  type Workout,
  type WorkoutLog,
} from "@/lib/programming/types";
import type { LoggerBlock, LoggerItem } from "@/components/WorkoutLogger";
import { neededFor } from "./equipment";

export async function loadLoggerData(supabase: SupabaseClient, workoutId: string, athleteId: string) {
  const { data: workout } = await supabase.from("workouts").select("*").eq("id", workoutId).maybeSingle<Workout>();
  if (!workout) return null;
  const { data: assignment } = workout.assignment_id
    ? await supabase.from("assignments").select("program_name, instructions").eq("id", workout.assignment_id).maybeSingle()
    : { data: null };
  const { data: ready } = await supabase
    .from("readiness")
    .select("score")
    .eq("athlete_id", athleteId)
    .eq("checked_on", todayISO())
    .maybeSingle();
  const [{ data: itemRows }, { data: log }, lifts, maxes, bodyweight] = await Promise.all([
    supabase.from("workout_items").select(ITEM_COLUMNS).eq("workout_id", workoutId).order("position"),
    supabase.from("workout_logs").select("*").eq("workout_id", workoutId).eq("athlete_id", athleteId).maybeSingle<WorkoutLog>(),
    getLifts(supabase),
    getMaxes(supabase, athleteId),
    latestBodyweight(supabase, athleteId),
  ]);
  const items = (itemRows ?? []) as unknown as ItemFields[];
  const lastFor = (ids: string[]) =>
    ids.length
      ? supabase
          .from("set_logs")
          .select("reps, load_kg, value, metrics, exercise_id, workout_items!inner(workout_id), workout_logs!inner(workout_date, athlete_id)")
          .eq("workout_logs.athlete_id", athleteId)
          .in("exercise_id", ids)
          .neq("workout_items.workout_id", workoutId)
          .order("workout_date", { referencedTable: "workout_logs", ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] });
  const exIds = [...new Set(items.map((i) => i.exercise_id).filter(Boolean))] as string[];
  const [{ data: exRows }, { data: setRows }, { data: itemLogRows }, { data: lastRows }] = await Promise.all([
    exIds.length
      ? supabase.from("exercises").select("*").in("id", exIds)
      : Promise.resolve({ data: [] }),
    log ? supabase.from("set_logs").select("*").eq("log_id", log.id) : Promise.resolve({ data: [] }),
    log ? supabase.from("item_logs").select("*").eq("log_id", log.id) : Promise.resolve({ data: [] }),
    lastFor(exIds),
  ]);
  const exercises = new Map(((exRows ?? []) as Exercise[]).map((e) => [e.id, e]));
  const itemLogs = new Map(((itemLogRows ?? []) as ItemLog[]).map((l) => [l.item_id, l]));
  // Swapped-in exercises the client chose mid-workout
  const swapIds = [...new Set([...itemLogs.values()].map((l) => l.swap_exercise_id).filter((x): x is string => !!x && !exercises.has(x)))];
  const [{ data: swapRows }, { data: swapLast }] = await Promise.all([
    swapIds.length ? supabase.from("exercises").select("*").in("id", swapIds) : Promise.resolve({ data: [] }),
    lastFor(swapIds),
  ]);
  for (const e of (swapRows ?? []) as Exercise[]) exercises.set(e.id, e);
  const liftMap = new Map(lifts.map((l) => [l.key, l]));
  const latest = latestByLift(maxes);
  const sets = (setRows ?? []) as SetLog[];

  // Most recent previous session per exercise: "5 × 100 kg, 5 × 100 kg…"
  const last = new Map<string, { date: string; sets: { reps: number | null; load_kg: number | null; value: number | null; metrics: Record<string, number | null> }[] }>();
  for (const r of [...(lastRows ?? []), ...(swapLast ?? [])] as unknown as {
    reps: number | null;
    load_kg: string | null;
    value: string | null;
    metrics: Record<string, number | null> | null;
    exercise_id: string;
    workout_logs: { workout_date: string };
  }[]) {
    const ex = r.exercise_id;
    const date = r.workout_logs.workout_date;
    const cur = last.get(ex);
    if (cur && cur.date !== date) continue;
    const entry = { reps: r.reps, load_kg: r.load_kg == null ? null : Number(r.load_kg), value: r.value == null ? null : Number(r.value), metrics: r.metrics ?? {} };
    if (cur) cur.sets.push(entry);
    else last.set(ex, { date, sets: [entry] });
  }

  const today = todayISO();
  const locked = workout.workout_date < editableFrom(today);
  const early = workout.workout_date > addDays(today, 1);
  const finished = !!log?.completed_at;

  const blocks: LoggerBlock[] = byBlock(items).map(([letter, list]) => ({
    letter,
    title: blockTitle(list),
    superset: list.length > 1,
    items: list.map((it): LoggerItem => {
      const il = itemLogs.get(it.id);
      const planned = it.exercise_id ? exercises.get(it.exercise_id) : null;
      const swapped = il?.swap_exercise_id ? exercises.get(il.swap_exercise_id) : null;
      const ex = swapped ?? planned;
      const label = itemLabel(it, list.length);
      if (it.kind === "text" || !ex)
        return {
          id: it.id, kind: "text", label, name: it.title ?? "Notes", exerciseId: null, rx: "", meta: "",
          notes: it.notes, cues: null, videoUrl: null, loadChip: null, warn: null, prev: null,
          fields: [], restSec: null, sets: [], comment: il?.comment ?? "", done: !!il?.done, swap: null, plannedId: null, category: null,
        };
      const base = baseFor(ex.lift_key, liftMap, latest);
      const load = lineLoad(it, base, bodyweight);
      const logged = sets.filter((x) => x.item_id === it.id);
      const rows = Math.max(setCount(it.sets), ...logged.map((x) => x.set_no));
      const fields = fieldsFor(ex, it);
      const units: Units = { ...DEFAULT_UNITS, ...(ex.weight_unit ? { weight_unit: ex.weight_unit } : {}), ...(ex.distance_unit ? { distance_unit: ex.distance_unit } : {}), ...(ex.speed_unit ? { speed_unit: ex.speed_unit } : {}) };
      const prev = last.get(ex.id);
      const target = targetReps(it.reps);
      const timeTarget = it.reps && /\d+\s*s$/.test(it.reps) ? String(target) : it.reps && /\d+\s*min$/.test(it.reps) ? String((target ?? 0) * 60) : "";
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
                          velocity: it.velocity != null ? Number(it.velocity) : null,
            rest_sec: null,
            tempo: null,
          }) || "As prescribed",
        meta: [it.tempo && `tempo ${it.tempo}`, it.rest_sec ? `rest ${formatRest(it.rest_sec)}` : null].filter(Boolean).join(" · "),
        notes: it.notes,
        cues: ex.cues,
        videoUrl: ex.video_url,
        loadChip: load ? `${load.addedToBodyweight ? "+" : "~"}${suggestedDisplayWeight(load.kg, units)} ${units.weight_unit}` : null,
        warn:
          it.load_type === "percent" && !base && swapped
            ? "Swapped exercise: pick a weight that feels as hard as planned."
            : it.load_type === "percent" && !base
            ? "Save a 1RM in the calculator to see your load."
            : it.load_type === "percent" && base?.bodyweightLift && bodyweight == null
              ? "Add your bodyweight in a check-in to see your load."
              : null,
        prev: prev
          ? `${formatDate(prev.date)}: ` +
            prev.sets.map((x) => describeSet(x, fields, units) || "?").join(", ")
          : null,
        fields: fields.map((f) => ({ key: f, unit: unitLabel(f, units, ex.measure === "bodyweight" || !!load?.addedToBodyweight) })),
        restSec: it.rest_sec,
        sets: Array.from({ length: rows }, (_, k) => {
          const no = k + 1;
          const x = logged.find((y) => y.set_no === no);
          const m = (x?.metrics ?? {}) as Record<string, number | null>;
          const v: Record<string, string> = {};
          if (x)
            for (const f of fields)
              v[f] =
                f === "reps" ? (x.reps != null ? String(x.reps) : "")
                : f === "weight" ? fromCanonical("weight", x.load_kg != null ? Number(x.load_kg) : null, units)
                : fromCanonical(f, m[f] ?? (f === fields[0] && x.value != null ? Number(x.value) : null), units);
          const hint: Record<string, string> = {};
          for (const f of fields) {
            if (f === "reps" && target != null && !timeTarget) hint.reps = String(target);
            if (f === "weight" && load) hint.weight = suggestedDisplayWeight(load.kg, units);
            if (f === "time" && timeTarget) hint.time = timeTarget;
            if (f === "rpe" && it.rpe != null) hint.rpe = String(Number(it.rpe));
            if (f === "velocity" && it.velocity != null) hint.velocity = String(Number(it.velocity));
            if (f === "calories" && it.reps && /\d+\s*cal$/i.test(it.reps)) hint.calories = String(target);
            if (f === "distance" && it.reps && /\d+\s*m$/i.test(it.reps) && target != null)
              hint.distance = fromCanonical("distance", target, units);
          }
          return {
            setNo: no,
            v,
            hint,
            done: !!x?.done,
          };
        }),
        comment: il?.comment ?? "",
        done: !!il?.done,
        swap: swapped && planned ? { fromName: planned.name, reason: il?.swap_reason ?? null, note: il?.swap_note ?? null } : null,
        plannedId: planned?.id ?? null,
        category: planned?.category ?? ex.category,
      };
    }),
  }));

  const { data: prevLog } = await supabase
    .from("workout_logs")
    .select("session_rpe, workout_date")
    .eq("athlete_id", athleteId)
    .not("completed_at", "is", null)
    .neq("workout_id", workoutId)
    .lte("workout_date", workout.workout_date)
    .order("workout_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastRpe = prevLog?.session_rpe ? { rpe: prevLog.session_rpe as number, date: formatDate(prevLog.workout_date as string) } : null;

  // What to bring: the exercises actually being done (swaps included)
  const equipment = neededFor(
    items
      .filter((it) => it.kind === "exercise" && it.exercise_id)
      .map((it) => {
        const sw = itemLogs.get(it.id)?.swap_exercise_id;
        return exercises.get(sw ?? it.exercise_id!)?.equipment ?? [];
      }),
  );

  return { workout, assignment, ready, log, items, blocks, locked, early, finished, today, lastRpe, equipment };
}
