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
        .select("id, full_name, email, status, consent_version, profile_completed_at, last_seen_at, feat_program, feat_checkin")
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

  const Card = ({ k, count, tone = "brand", children }: { k: OverviewCard; count: number | string; tone?: "brand" | "warn" | "ok"; children: ReactNode }) =>
    show(k) ? (
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
            {OVERVIEW_CARDS.find((c) => c[0] === k)![1]}
          </h3>
          <span className={`text-lg font-black ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-brand"}`}>{count}</span>
        </div>
        <div className="max-h-56 overflow-y-auto text-sm">{children}</div>
      </section>
    ) : null;
  const Person = ({ id, children, href }: { id: string; children?: ReactNode; href?: string }) => (
    <Link href={href ?? `/coach/athlete/${id}`} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 hover:bg-surface-2">
      <span className="truncate font-semibold">{name.get(id) ?? "Client"}</span>
      <span className="shrink-0 text-xs text-muted">{children}</span>
    </Link>
  );
  const none = <p className="text-muted">All clear.</p>;

  return (
    <div className="mb-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card k="setup" count={setup.length} tone={setup.length ? "brand" : "ok"}>
          {setup.length ? setup.map((s) => <Person key={s.id} id={s.id}>{s.why}</Person>) : none}
        </Card>
        <Card k="checkins" count={missedCheckins.length} tone={missedCheckins.length ? "warn" : "ok"}>
          {missedCheckins.length ? missedCheckins.map((c) => <Person key={c.id} id={c.id}>last week</Person>) : none}
        </Card>
        <Card k="inactive" count={inactive.length} tone={inactive.length ? "warn" : "ok"}>
          {inactive.length
            ? inactive.map((c) => <Person key={c.id} id={c.id}>{c.last ? `last ${formatDate(c.last.slice(0, 10))}` : "never opened"}</Person>)
            : none}
        </Card>
        <Card k="followups" count={(follow ?? []).length} tone={(follow ?? []).some((f) => f.due_on <= today) ? "brand" : "ok"}>
          {(follow ?? []).length
            ? (follow ?? []).map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-2 py-1">
                  <Link href={`/coach/athlete/${f.athlete_id}`} className="min-w-0">
                    <span className="block font-semibold">{name.get(f.athlete_id) ?? "Client"}</span>
                    <span className={`block text-xs ${f.due_on < today ? "text-brand" : "text-muted"}`}>
                      {f.due_on < today ? "Overdue · " : f.due_on === today ? "Today · " : `${formatDate(f.due_on)} · `}
                      {f.note}
                    </span>
                  </Link>
                  <form action={clearFollowUp}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="min-h-9 rounded-lg border border-line px-2 text-xs font-bold">Done</button>
                  </form>
                </div>
              ))
            : <p className="text-muted">Nothing due. Add follow-ups from a client&apos;s profile.</p>}
        </Card>
        <Card k="pbs" count={pbs.length} tone="ok">
          {pbs.length
            ? pbs.map((p) => {
                const [athlete, ex] = p.key.split("|");
                return (
                  <Person key={p.key} id={athlete} href={`/coach/athlete/${athlete}/progress/${ex}`}>
                    {exName.get(ex)} {p.reps}×{p.kg}kg (e1RM {p.e1rm}, +{Math.round((p.e1rm - p.previous) * 10) / 10})
                  </Person>
                );
              })
            : <p className="text-muted">None this week yet.</p>}
        </Card>
        <Card k="expiring" count={expiring.filter((r) => r.daysLeft! <= 7).length} tone={expiring.length ? "brand" : "ok"}>
          {expiring.length
            ? expiring.map((r) => (
                <Person key={r.id} id={r.id} href={`/coach/athlete/${r.id}/program`}>
                  <span className={r.daysLeft! <= 7 ? "text-brand" : "text-warn"}>
                    last {formatDate(r.lastDate!)} ({r.daysLeft}d)
                  </span>
                </Person>
              ))
            : none}
        </Card>
        <Card k="expired" count={expired.length} tone={expired.length ? "brand" : "ok"}>
          {expired.length
            ? expired.map((id) => <Person key={id} id={id} href={`/coach/athlete/${id}/program`}>nothing scheduled</Person>)
            : none}
        </Card>
        <Card k="compliance" count={comp.average == null ? "—" : `${comp.average}%`} tone={comp.average == null || comp.average >= 80 ? "ok" : comp.average >= 60 ? "warn" : "brand"}>
          <p className="mb-1 text-xs text-muted">Workouts completed, last 7 days. Nutrition joins once macro logging is on.</p>
          {comp.per
            .filter((p) => p.pct != null)
            .sort((a, b) => a.pct! - b.pct!)
            .map((p) => (
              <Person key={p.id} id={p.id} href={`/coach/athlete/${p.id}/program`}>
                <span className={p.pct! >= 80 ? "text-ok" : p.pct! >= 60 ? "text-warn" : "text-brand"}>
                  {p.done}/{p.total} · {p.pct}%
                </span>
              </Person>
            ))}
        </Card>
        <Card k="signin" count={`${sign.pctActive}%`} tone={sign.pctActive >= 70 ? "ok" : "warn"}>
          <p>
            <span className="font-bold">{sign.pctActive}%</span> of active clients opened the app in the last 7 days.
          </p>
          <p className="mt-1">
            Average <span className="font-bold">{sign.avgDays}</span> active days per client this week.
          </p>
        </Card>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-muted">Customise cards</summary>
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
