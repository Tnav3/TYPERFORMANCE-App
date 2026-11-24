import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/week";
import { loggedSets } from "./history-data";
import {
  change,
  lastWeeks,
  strengthTrend,
  weeklyCompliance,
  weeklyCount,
  weeklyVolume,
  type Point,
  type WidgetKey,
} from "./widgets";

export interface WidgetData {
  key: WidgetKey;
  title: string;
  unit: string;
  points: Point[];
  latest: number | null;
  diff: number | null;
  pct: number | null;
  /** True when a rise is bad news (none of ours yet, kept for bodyweight cuts). */
  kind: "bars" | "line";
  note?: string;
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Loads only what the chosen widgets need. `coach` decides whether the planned-workout RPC is used. */
export async function loadWidgets(
  supabase: SupabaseClient,
  athleteId: string,
  today: string,
  keys: WidgetKey[],
  opts: { coach: boolean; weeks?: number } = { coach: true },
): Promise<WidgetData[]> {
  const weeks = lastWeeks(today, opts.weeks ?? 8);
  const from = weeks[0];
  const to = addDays(weeks[weeks.length - 1], 6);
  const need = (k: WidgetKey) => keys.includes(k);

  const [sets, bw, ready, planned, logs] = await Promise.all([
    need("volume") || need("strength") ? loggedSets(supabase, athleteId) : Promise.resolve([]),
    need("bodyweight")
      ? supabase.from("body_metrics").select("measured_on, weight_kg").eq("athlete_id", athleteId).gte("measured_on", from).order("measured_on").then((r) => r.data ?? [])
      : Promise.resolve([]),
    need("readiness")
      ? supabase.from("readiness").select("checked_on, score").eq("athlete_id", athleteId).gte("checked_on", from).then((r) => r.data ?? [])
      : Promise.resolve([]),
    need("compliance")
      ? (opts.coach
          ? supabase.rpc("client_workouts", { p_athlete: athleteId, p_from: from, p_to: to })
          : supabase.rpc("my_workouts", { p_from: from, p_to: to })
        ).then((r) => (r.data ?? []) as { id: string; workout_date: string }[])
      : Promise.resolve([] as { id: string; workout_date: string }[]),
    need("compliance") || need("sessions")
      ? supabase.from("workout_logs").select("workout_id, workout_date, completed_at").eq("athlete_id", athleteId).gte("workout_date", from).not("completed_at", "is", null).then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  const recent = sets.filter((s) => s.date >= from);
  let liftName: string | null = null;
  const strength = need("strength") ? strengthTrend(recent, weeks) : null;
  if (strength?.key) {
    const { data } = await supabase.from("exercises").select("name").eq("id", strength.key).maybeSingle();
    liftName = data?.name ?? null;
  }

  const out: WidgetData[] = [];
  for (const k of keys) {
    let points: Point[] = [];
    let title = "";
    let unit = "";
    let kind: "bars" | "line" = "bars";
    let note: string | undefined;
    if (k === "volume") {
      points = weeklyVolume(recent, weeks);
      title = "Training volume";
      unit = "kg/wk";
    } else if (k === "strength") {
      points = strength!.points;
      title = liftName ? `${liftName} e1RM` : "Strength";
      unit = "kg";
      kind = "line";
      if (!strength!.key) note = "No loaded sets logged yet";
    } else if (k === "bodyweight") {
      points = (bw as { measured_on: string; weight_kg: string | null }[])
        .filter((r) => r.weight_kg != null)
        .map((r) => ({ label: r.measured_on, value: Number(r.weight_kg) }));
      title = "Bodyweight";
      unit = "kg";
      kind = "line";
      if (!points.length) note = "No weigh-ins yet";
    } else if (k === "compliance") {
      const done = new Set((logs as { workout_id: string }[]).map((l) => l.workout_id));
      const past = (planned as { id: string; workout_date: string }[]).filter((w) => w.workout_date <= today);
      points = weeklyCompliance(
        past.map((w) => w.workout_date),
        past.filter((w) => done.has(w.id)).map((w) => w.workout_date),
        weeks,
      );
      title = "Compliance";
      unit = "%";
      if (!past.length) note = "No program assigned";
    } else if (k === "readiness") {
      const r = ready as { checked_on: string; score: number | null }[];
      points = weeks.map((w) => ({
        label: w,
        value: avg(r.filter((x) => x.checked_on >= w && x.checked_on <= addDays(w, 6) && x.score != null).map((x) => x.score!)),
      }));
      title = "Readiness";
      unit = "/100";
      kind = "line";
      if (!r.length) note = "No check-ins yet";
    } else if (k === "sessions") {
      points = weeklyCount((logs as { workout_date: string }[]).map((l) => l.workout_date), weeks);
      title = "Sessions";
      unit = "/wk";
    }
    // Weekly totals: this week is still in progress, so the headline is last full week vs the week before.
    const c = kind === "bars" && points.length > 2 ? change(points.slice(-3, -1)) : change(points);
    out.push({ key: k, title, unit, points, kind, note, ...c });
  }
  return out;
}
