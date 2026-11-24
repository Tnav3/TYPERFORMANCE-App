// Coach overview cards (Trainerize-style "at a glance"). Each card can be hidden.
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { CONSENT_VERSION } from "@/lib/consent";
import { formatDate } from "@/lib/dates";
import { addDays } from "@/lib/week";
import { newPBs } from "@/lib/programming/history";
import {
  expiredClients,
  OVERVIEW_CARDS,
  scheduledFor,
  signInSummary,
  workoutCompliance,
  type OverviewCard,
} from "@/lib/programming/overview";
import { programRunway } from "@/lib/programming/runway";
import { currentDue, isOverdue, type Repeat } from "@/lib/forms";
import { clearFollowUp, saveDashboardPrefs } from "@/app/coach/overview-actions";

type Client = {
  id: string;
  full_name: string | null;
  email: string;
  status: string;
  consent_version: string | null;
  profile_completed_at: string | null;
  last_seen_at: string | null;
  feat_program: boolean;
  feat_checkin: boolean;
  feat_macros: boolean;
};

export async function CoachOverview({
  supabase,
  today,
  hidden,
  missedCheckins,
}: {
  supabase: SupabaseClient;
  today: string;
  hidden: string[];
  missedCheckins: { id: string; name: string }[];
}) {
  const show = (k: OverviewCard) => !hidden.includes(k);
  const weekAgo = addDays(today, -7);
  const monthAgo = addDays(today, -28);

  const [{ data: profiles }, { data: workouts }, { data: members }, { data: logs }, { data: follow }, { data: opens }, { data: setRows }, { data: everAssigned }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, status, consent_version, profile_completed_at, last_seen_at, feat_program, feat_checkin, feat_macros")
        .eq("role", "athlete")
        .neq("status", "inactive"),
      supabase.from("workouts").select("id, athlete_id, group_id, workout_date, overrides_id").gte("workout_date", monthAgo),
      supabase.from("group_members").select("group_id, athlete_id"),
      supabase.from("workout_logs").select("athlete_id, workout_id").not("completed_at", "is", null).gte("workout_date", weekAgo),
      show("followups")
        ? supabase.from("follow_ups").select("id, athlete_id, due_on, note").is("done_at", null).lte("due_on", addDays(today, 3)).order("due_on")
        : Promise.resolve({ data: [] }),
      show("signin") ? supabase.from("app_opens").select("athlete_id, opened_on").gte("opened_on", weekAgo) : Promise.resolve({ data: [] }),
      show("pbs")
        ? supabase
            .from("set_logs")
            .select("reps, load_kg, workout_items!inner(exercise_id, exercises(name)), workout_logs!inner(workout_date, athlete_id)")
            .eq("done", true)
            .gt("load_kg", 0)
            .limit(20000)
        : Promise.resolve({ data: [] }),
      supabase.from("workouts").select("athlete_id, group_id").limit(5000),
    ]);
  const [{ data: fAsg }, { data: fResp }] = await Promise.all([
    supabase.from("form_assignments").select("athlete_id, form_id, repeat, starts_on, forms(name, archived)").eq("active", true),
    supabase.from("form_responses").select("id, athlete_id, form_id, due_on, coach_seen_at").gte("due_on", addDays(today, -62)),
  ]);
  const unread = (fResp ?? []).filter((r) => !r.coach_seen_at);
  const formOverdue = (fAsg ?? [])
    .filter((a) => !(a.forms as unknown as { archived: boolean } | null)?.archived)
    .map((a) => ({ a, due: currentDue({ repeat: a.repeat as Repeat, starts_on: a.starts_on }, today) }))
    .filter(({ a, due }) => isOverdue(due, (fResp ?? []).some((r) => r.athlete_id === a.athlete_id && r.form_id === a.form_id && r.due_on === due), today));
  const { data: macroRows } = show("compliance")
    ? await supabase.from("macro_logs").select("athlete_id, day").gte("day", weekAgo).lt("day", today)
    : { data: [] };

  const all = (profiles ?? []) as Client[];
  const active = all.filter((c) => c.status === "active");
  const name = new Map(all.map((c) => [c.id, c.full_name ?? c.email]));
  const programmed = active.filter((c) => c.feat_program !== false).map((c) => c.id);
  const w = workouts ?? [];
  const m = members ?? [];

  // Incomplete setups
  const assigned = new Set<string>();
  const groupsWithWork = new Set<string>();
  for (const x of everAssigned ?? []) {
    if (x.athlete_id) assigned.add(x.athlete_id);
    if (x.group_id) groupsWithWork.add(x.group_id);
  }
  for (const x of m) if (groupsWithWork.has(x.group_id)) assigned.add(x.athlete_id);
  const setup = all
    .map((c) => {
      const why =
        c.status === "pending" && c.profile_completed_at
          ? "Waiting for your approval"
          : c.consent_version !== CONSENT_VERSION
            ? "Hasn't accepted consent"
            : !c.profile_completed_at
              ? "Profile not finished"
              : c.feat_program !== false && !assigned.has(c.id)
                ? "No program ever assigned"
                : null;
      return why ? { id: c.id, why } : null;
    })
    .filter(Boolean) as { id: string; why: string }[];

  // Inactive (7+ days)
  const inactive = active
    .filter((c) => !c.last_seen_at || c.last_seen_at.slice(0, 10) < weekAgo)
    .map((c) => ({ id: c.id, last: c.last_seen_at }));

  // Expiring / expired
  const runway = programRunway(
    today,
    programmed.map((id) => ({ id, name: name.get(id) ?? "" })),
    w,
    m,
  );
  const expiring = runway.filter((r) => r.daysLeft !== null);
  const hasFuture = new Set(programmed.filter((id) => !runway.some((r) => r.id === id && r.daysLeft === null)));
  const expired = expiredClients(programmed, scheduledFor(w, m, monthAgo, addDays(today, -1)), hasFuture);

  // Compliance (last 7 days, not today)
  const comp = workoutCompliance(programmed, scheduledFor(w, m, weekAgo, addDays(today, -1)), logs ?? []);
  const macroClients = active.filter((c) => c.feat_macros).map((c) => c.id);
  const macroDays = new Map<string, number>();
  for (const r of macroRows ?? []) macroDays.set(r.athlete_id, (macroDays.get(r.athlete_id) ?? 0) + 1);
  const nutritionAvg = macroClients.length
    ? Math.round((macroClients.reduce((a, c) => a + Math.min(7, macroDays.get(c) ?? 0), 0) / (macroClients.length * 7)) * 100)
    : null;
  const sign = signInSummary(active.map((c) => c.id), opens ?? []);

  // New PBs (last 7 days)
  const exName = new Map<string, string>();
  const pbRows = ((setRows ?? []) as unknown as {
    reps: number | null;
    load_kg: string | null;
    workout_items: { exercise_id: string; exercises: { name: string } | null };
    workout_logs: { workout_date: string; athlete_id: string };
  }[]).map((r) => {
    exName.set(r.workout_items.exercise_id, r.workout_items.exercises?.name ?? "Exercise");
    return {
      key: `${r.workout_logs.athlete_id}|${r.workout_items.exercise_id}`,
      date: r.workout_logs.workout_date,
      reps: r.reps,
      kg: r.load_kg == null ? null : Number(r.load_kg),
      value: null,
    };
  });
  const pbs = newPBs(pbRows, weekAgo).slice(0, 12);

  const Person = ({ id, children, href }: { id: string; children?: ReactNode; href?: string }) => (
    <Link href={href ?? `/coach/athlete/${id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 hover:bg-surface-2">
      <span className="truncate font-semibold">{name.get(id) ?? "Client"}</span>
      <span className="shrink-0 text-xs text-muted">{children}</span>
    </Link>
  );

  const dueFollow = (follow ?? []).filter((f) => f.due_on <= today);
  const soon = expiring.filter((r) => r.daysLeft! <= 7);
  type Item = { k: OverviewCard; label: string; count: number; win?: boolean; body: ReactNode };
  const items: Item[] = [
    {
      k: "followups",
      label: "Follow-ups due",
      count: dueFollow.length,
      body: (follow ?? []).map((f) => (
        <div key={f.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
          <Link href={`/coach/athlete/${f.athlete_id}`} className="min-w-0">
            <span className="block font-semibold">{name.get(f.athlete_id) ?? "Client"}</span>
            <span className={`block text-xs ${f.due_on < today ? "text-brand" : "text-muted"}`}>
              {f.due_on < today ? "Overdue · " : f.due_on === today ? "Today · " : `${formatDate(f.due_on)} · `}
              {f.note}
            </span>
          </Link>
          <form action={clearFollowUp}>
            <input type="hidden" name="id" value={f.id} />
            <button className="min-h-10 rounded-lg border border-line px-3 text-xs font-bold">Done</button>
          </form>
        </div>
      )),
    },
    {
      k: "checkins",
      label: "New check-ins to read",
      count: unread.length,
      body: unread.map((r) => <Person key={r.id} id={r.athlete_id} href={`/coach/athlete/${r.athlete_id}/forms`}>Read →</Person>),
    },
    {
      k: "checkins",
      label: "Check-in form overdue",
      count: formOverdue.length,
      body: formOverdue.map(({ a, due }) => (
        <Person key={a.athlete_id + a.form_id} id={a.athlete_id} href={`/coach/athlete/${a.athlete_id}/forms`}>
          {(a.forms as unknown as { name: string } | null)?.name} · due {formatDate(due!)}
        </Person>
      )),
    },
    {
      k: "expired",
      label: "Program finished – nothing scheduled",
      count: expired.length,
      body: expired.map((id) => <Person key={id} id={id} href={`/coach/athlete/${id}/program`}>Assign program →</Person>),
    },
    {
      k: "expiring",
      label: "Program ends within 7 days",
      count: soon.length,
      body: expiring.map((r) => (
        <Person key={r.id} id={r.id} href={`/coach/athlete/${r.id}/program`}>
          <span className={r.daysLeft! <= 7 ? "text-brand" : "text-warn"}>
            {r.daysLeft} days left · {formatDate(r.lastDate!)}
          </span>
        </Person>
      )),
    },
    {
      k: "setup",
      label: "Setup not finished",
      count: setup.length,
      body: setup.map((x) => <Person key={x.id} id={x.id}>{x.why}</Person>),
    },
    {
      k: "checkins",
      label: "Missed last week's check-in",
      count: missedCheckins.length,
      body: missedCheckins.map((c) => <Person key={c.id} id={c.id}>Open →</Person>),
    },
    {
      k: "inactive",
      label: "Haven't opened the app in 7+ days",
      count: inactive.length,
      body: inactive.map((c) => <Person key={c.id} id={c.id}>{c.last ? `last ${formatDate(c.last.slice(0, 10))}` : "never opened"}</Person>),
    },
    {
      k: "pbs",
      label: "New personal bests",
      count: pbs.length,
      win: true,
      body: pbs.map((p) => {
        const [athlete, ex] = p.key.split("|");
        return (
          <Person key={p.key} id={athlete} href={`/coach/athlete/${athlete}/progress/${ex}`}>
            {exName.get(ex)} {p.reps}×{p.kg} kg
          </Person>
        );
      }),
    },
  ].filter((i) => show(i.k as OverviewCard)) as Item[];
  const todo = items.filter((i) => i.count > 0 && !i.win);
  const wins = items.filter((i) => i.count > 0 && i.win);

  const pctTone = (n: number | null) => (n == null || n >= 80 ? "text-ok" : n >= 60 ? "text-warn" : "text-brand");
  const Row = ({ i }: { i: Item }) => (
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
        <span className="font-bold">{i.label}</span>
        <span className="flex items-center gap-2">
          <span className={`min-w-8 rounded-full px-2.5 py-0.5 text-center text-sm font-black ${i.win ? "bg-ok/15 text-ok" : "bg-brand/15 text-brand"}`}>{i.count}</span>
          <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>›</span>
        </span>
      </summary>
      <div className="max-h-72 overflow-y-auto border-t border-line px-2 py-2 text-sm">{i.body}</div>
    </details>
  );

  return (
    <div className="mb-8">
      {(show("compliance") || show("signin")) && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {show("compliance") && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Workouts done</p>
              <p className={`text-3xl font-black ${pctTone(comp.average)}`}>{comp.average == null ? "—" : `${comp.average}%`}</p>
              <p className="text-xs text-muted">
                last 7 days{nutritionAvg != null ? ` · food logged ${nutritionAvg}%` : ""}
              </p>
            </div>
          )}
          {show("signin") && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Using the app</p>
              <p className={`text-3xl font-black ${sign.pctActive >= 70 ? "text-ok" : "text-warn"}`}>{sign.pctActive}%</p>
              <p className="text-xs text-muted">opened it this week</p>
            </div>
          )}
        </div>
      )}

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Needs your attention</h2>
      {todo.length ? (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {todo.map((i) => <Row key={i.k + i.label} i={i} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-ok/40 bg-ok/10 px-4 py-4 font-bold text-ok">All clear. Nothing needs you right now.</div>
      )}
      {wins.length > 0 && (
        <div className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {wins.map((i) => <Row key={i.k} i={i} />)}
        </div>
      )}
      {show("compliance") && comp.per.some((p) => p.pct != null) && (
        <details className="mt-2 overflow-hidden rounded-2xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-bold text-muted">Workouts done per client</summary>
          <div className="border-t border-line px-2 py-2 text-sm">
            {comp.per
              .filter((p) => p.pct != null)
              .sort((a, b) => a.pct! - b.pct!)
              .map((p) => (
                <Person key={p.id} id={p.id} href={`/coach/athlete/${p.id}/program`}>
                  <span className={pctTone(p.pct)}>{p.done} of {p.total}</span>
                </Person>
              ))}
          </div>
        </details>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer px-1 text-xs text-muted">Choose what shows here</summary>
        <form action={saveDashboardPrefs} className="mt-2 grid gap-1 rounded-xl border border-line bg-surface p-3 sm:grid-cols-3">
          {OVERVIEW_CARDS.map(([k, label]) => (
            <label key={k} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="show" value={k} defaultChecked={!hidden.includes(k)} className="h-5 w-5 accent-[var(--color-brand)]" />
              {label}
            </label>
          ))}
          <button className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold sm:col-span-3">Save</button>
        </form>
      </details>
    </div>
  );
}
