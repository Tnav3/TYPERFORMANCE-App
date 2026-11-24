import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Award, Flame, Trophy } from "lucide-react";
import { requireFeature } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { addDays } from "@/lib/week";
import { setCount } from "@/lib/prescription";
import { loggedSets } from "@/lib/programming/history-data";
import { pbEvents, sessions } from "@/lib/programming/history";
import { badgesFor, readinessTone, weeklyStreak } from "@/lib/programming/rewards";
import type { Workout } from "@/lib/programming/types";
import { Celebrate } from "@/components/Celebrate";
import { Card, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireFeature(["athlete"], "program");
  const { id } = await params;
  const me = user!.id;
  const [{ data: workout }, { data: log }] = await Promise.all([
    supabase.from("workouts").select("*").eq("id", id).maybeSingle<Workout>(),
    supabase.from("workout_logs").select("*").eq("workout_id", id).eq("athlete_id", me).maybeSingle(),
  ]);
  if (!workout) notFound();
  if (!log?.completed_at) redirect(`/train/${id}`);
  const today = todayISO();

  const [{ data: items }, { data: sets }, all, { data: ready }, { data: earned }, { count: workoutsDone }, { data: sched }, { data: doneLogs }] =
    await Promise.all([
      supabase.from("workout_items").select("id, kind, sets, exercise_id, exercises(name)").eq("workout_id", id),
      supabase.from("set_logs").select("item_id, reps, load_kg, value").eq("log_id", log.id),
      loggedSets(supabase, me),
      supabase.from("readiness").select("score").eq("athlete_id", me).eq("checked_on", workout.workout_date).maybeSingle(),
      supabase.from("badges").select("key").eq("athlete_id", me),
      supabase.from("workout_logs").select("id", { count: "exact", head: true }).eq("athlete_id", me).not("completed_at", "is", null),
      supabase.rpc("my_workouts", { p_from: addDays(today, -26 * 7), p_to: addDays(today, 6) }),
      supabase.from("workout_logs").select("workout_id").eq("athlete_id", me).not("completed_at", "is", null).gte("workout_date", addDays(today, -26 * 7)),
    ]);
  const itemRows = (items ?? []) as unknown as { id: string; kind: string; sets: number | null; exercise_id: string | null; exercises: { name: string } | null }[];
  const setRows = (sets ?? []) as { item_id: string; reps: number | null; load_kg: string | null; value: string | null }[];

  // Totals
  const exItems = itemRows.filter((i) => i.kind === "exercise");
  const prescribed = exItems.reduce((a, i) => a + setCount(i.sets), 0);
  const done = setRows.length;
  const volume = Math.round(setRows.reduce((a, s) => a + (s.load_kg ? Number(s.load_kg) * (s.reps ?? 0) : 0), 0));

  // Per exercise: today vs last time, PBs today
  const exIds = [...new Set(exItems.map((i) => i.exercise_id!).filter(Boolean))];
  const pbsToday = pbEvents(all).filter((p) => p.date === workout.workout_date && exIds.includes(p.key));
  const rows = exIds.map((ex) => {
    const ss = sessions(all.filter((r) => r.key === ex));
    const cur = ss.find((s) => s.date === workout.workout_date);
    const prev = ss.find((s) => s.date < workout.workout_date);
    return {
      ex,
      name: exItems.find((i) => i.exercise_id === ex)?.exercises?.name ?? "Exercise",
      cur,
      prev,
      pb: pbsToday.find((p) => p.key === ex),
    };
  });

  // Rewards
  const streak = weeklyStreak(
    today,
    ((sched ?? []) as Workout[]).map((w) => ({ id: w.id, date: w.workout_date })),
    new Set((doneLogs ?? []).map((l) => l.workout_id)),
  );
  const have = new Set((earned ?? []).map((b) => b.key));
  const fresh = badgesFor({ workouts: workoutsDone ?? 0, streakWeeks: streak, pbs: pbEvents(all).length }).filter((b) => !have.has(b.key));
  if (fresh.length)
    await supabase.from("badges").insert(fresh.map((b) => ({ athlete_id: me, key: b.key, detail: b.title })));
  const celebrate = fresh.length > 0 || pbsToday.length > 0;

  return (
    <Screen>
      {celebrate && <Celebrate />}
      <p className="pt-4 text-center text-xs uppercase tracking-widest text-brand">Workout complete</p>
      <Heading sub={formatDate(workout.workout_date)}>{workout.title}</Heading>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <Card className="!p-3">
          <p className="text-2xl font-black">{log.duration_min}</p>
          <p className="text-xs text-muted">minutes</p>
        </Card>
        <Card className="!p-3">
          <p className="text-2xl font-black">
            {done}
            <span className="text-base text-muted">/{prescribed}</span>
          </p>
          <p className="text-xs text-muted">sets</p>
        </Card>
        <Card className="!p-3">
          <p className="text-2xl font-black">{volume.toLocaleString("en-AU")}</p>
          <p className="text-xs text-muted">kg lifted</p>
        </Card>
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-surface-2 px-3 py-1">RPE {log.session_rpe}</span>
        <span className="rounded-full bg-surface-2 px-3 py-1">Load {log.session_rpe * log.duration_min}</span>
        {ready && (
          <span className={`rounded-full px-3 py-1 ${readinessTone(ready.score) === "ok" ? "bg-ok/15 text-ok" : readinessTone(ready.score) === "warn" ? "bg-warn/15 text-warn" : "bg-brand/15 text-brand"}`}>
            Readiness {ready.score}
          </span>
        )}
        {streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-3 py-1 text-brand">
            <Flame size={14} /> {streak}-week streak
          </span>
        )}
      </div>

      {(pbsToday.length > 0 || fresh.length > 0) && (
        <Card className="mb-4 border-ok/60">
          {pbsToday.map((p) => (
            <p key={p.key} className="flex items-center gap-2 font-black">
              <Trophy size={18} className="text-warn" /> New PB: {rows.find((r) => r.ex === p.key)?.name} · e1RM {p.e1rm} kg
              <span className="text-sm font-normal text-ok">(+{Math.round((p.e1rm - p.previous) * 10) / 10})</span>
            </p>
          ))}
          {fresh.map((b) => (
            <p key={b.key} className="mt-2 flex items-start gap-2">
              <Award size={18} className="mt-0.5 shrink-0 text-brand" />
              <span>
                <span className="font-black">{b.title}</span>
                <span className="block text-sm text-muted">{b.detail}</span>
              </span>
            </p>
          ))}
        </Card>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Vs last time</h2>
        <div className="space-y-2">
          {rows.map((r) => {
            const diff = r.cur?.bestE1rm != null && r.prev?.bestE1rm != null ? Math.round((r.cur.bestE1rm - r.prev.bestE1rm) * 10) / 10 : null;
            return (
              <div key={r.ex} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-bold">{r.name}</p>
                  <p className="text-xs text-muted">
                    {r.cur?.topSet ? `Top set ${r.cur.topSet.reps} × ${r.cur.topSet.kg} kg` : r.cur ? `${r.cur.sets.length} sets` : "Not logged"}
                    {r.prev && ` · last ${formatDate(r.prev.date)}`}
                  </p>
                </div>
                {diff != null && (
                  <span className={`shrink-0 font-black ${diff > 0 ? "text-ok" : diff < 0 ? "text-warn" : "text-muted"}`}>
                    {diff > 0 ? "+" : ""}
                    {diff} kg
                  </span>
                )}
                {r.pb && <Trophy size={18} className="shrink-0 text-warn" aria-label="PB" />}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-2">
        <Link href="/train" className="flex min-h-12 items-center justify-center rounded-xl bg-brand font-extrabold uppercase text-white">
          Done
        </Link>
        <Link href={`/train/${id}`} className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface-2 font-extrabold uppercase">
          Back to workout
        </Link>
      </div>
    </Screen>
  );
}
