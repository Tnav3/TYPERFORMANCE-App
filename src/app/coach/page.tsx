import Link from "next/link";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { fightCountdown } from "@/lib/fight";
import { getDashboard, type DashboardRow } from "@/lib/dashboard";
import { formatChange, LIGHT_ORDER } from "@/lib/load-metrics";
import { dayMonth, addDays } from "@/lib/week";
import type { AccountStatus, Profile } from "@/lib/types";
import { Card, Logo, Screen, SignOutButton } from "@/components/ui";
import { TrafficLight } from "@/components/TrafficLight";
import { setAthleteStatus } from "./actions";
import { activityTone, byLeastRecent, lastSeenLabel } from "@/lib/activity";

export default async function CoachHome() {
  const { supabase } = await requireState(["coach"]);
  const today = todayISO();
  const { rows, noCheckin, pending, inactive, weeks } = await getDashboard(
    supabase,
    today,
  );
  const sorted = [...rows].sort(
    (a, b) =>
      LIGHT_ORDER[a.light] - LIGHT_ORDER[b.light] ||
      (a.profile.full_name ?? "").localeCompare(b.profile.full_name ?? ""),
  );
  const counts = { red: 0, amber: 0, green: 0, none: 0 };
  rows.forEach((r) => counts[r.light]++);
  const notSubmitted = rows.filter((r) => r.missedLastWeek).length;
  const { data: seen } = await supabase
    .from("profiles")
    .select("id, full_name, last_seen_at")
    .eq("role", "athlete")
    .eq("status", "active");
  const now = new Date();
  const activity = byLeastRecent(
    (seen ?? []) as {
      id: string;
      full_name: string | null;
      last_seen_at: string | null;
    }[],
  );
  const activeWeek = activity.filter(
    (a) => activityTone(a.last_seen_at, now) === "ok",
  ).length;

  return (
    <Screen wide>
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <h1 className="text-xl font-black uppercase tracking-tight">
            Dashboard
          </h1>
        </div>
        <SignOutButton />
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <Link
          href="/week"
          className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm font-extrabold uppercase tracking-wide"
        >
          Log my training
        </Link>
        <Link
          href="/coach/settings"
          className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm font-extrabold uppercase tracking-wide"
        >
          Settings
        </Link>
        <Link
          href="/calculator"
          className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm font-extrabold uppercase tracking-wide"
        >
          1RM Calculator
        </Link>
        <Link
          href="/mas"
          className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm font-extrabold uppercase tracking-wide"
        >
          MAS Calculator
        </Link>
        <Link
          href="/rpe"
          className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm font-extrabold uppercase tracking-wide"
        >
          RPE &amp; RIR Chart
        </Link>
        <Link
          href="/hr"
          className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm font-extrabold uppercase tracking-wide"
        >
          HR Zones
        </Link>
        <Link
          href="/coach/fights"
          className="col-span-2 flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm font-extrabold uppercase tracking-wide"
        >
          Competition Tracker
        </Link>
      </div>

      {pending.length > 0 && (
        <Section title={`Waiting for approval · ${pending.length}`}>
          {pending.map((p) => (
            <AccessRow
              key={p.id}
              p={p}
              actions={[
                { label: "Approve", status: "active", primary: true },
                { label: "Decline", status: "inactive" },
              ]}
            />
          ))}
        </Section>
      )}

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Last week · {dayMonth(weeks.lastWeek)} –{" "}
            {dayMonth(addDays(weeks.lastWeek, 6))}
          </h2>
          <p className="text-xs text-muted">
            vs week of {dayMonth(weeks.prevWeek)} · {counts.red} red ·{" "}
            {counts.amber} amber · {counts.green} green
            {notSubmitted ? ` · ${notSubmitted} not submitted` : ""}
          </p>
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">
            {noCheckin.length
              ? "No athletes with the weekly check-in switched on."
              : "No active athletes yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {sorted.map((r) => (
              <AthleteCard key={r.profile.id} r={r} today={today} />
            ))}
          </div>
        )}
      </section>

      {noCheckin.length > 0 && (
        <Section title={`Check-in switched off · ${noCheckin.length}`}>
          {noCheckin.map((p) => (
            <Link key={p.id} href={`/coach/athlete/${p.id}`} className="block">
              <Card className="flex items-center justify-between !p-4 hover:border-muted">
                <p className="truncate font-extrabold">
                  {p.full_name ?? p.email}
                </p>
                <span className="text-xl text-muted" aria-hidden>
                  →
                </span>
              </Card>
            </Link>
          ))}
        </Section>
      )}

      {activity.length > 0 && (
        <details className="mb-8 rounded-xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 text-sm font-extrabold">
            <span>App use</span>
            <span className="font-semibold text-muted">
              {activeWeek} of {activity.length} opened it in the last 7 days
            </span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {activity.map((a) => {
              const tone = activityTone(a.last_seen_at, now);
              return (
                <li key={a.id}>
                  <Link
                    href={`/coach/athlete/${a.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 px-4 text-sm"
                  >
                    <span className="truncate font-bold">
                      {a.full_name ?? "Unnamed"}
                    </span>
                    <span
                      className={`shrink-0 ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-brand"}`}
                    >
                      {lastSeenLabel(a.last_seen_at, now)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">
            Last time each client opened the app. Green: this week · amber: 1–3
            weeks · red: longer or never.
          </p>
        </details>
      )}

      {inactive.length > 0 && (
        <details className="mb-8">
          <summary className="mb-3 cursor-pointer text-xs font-semibold uppercase tracking-widest text-muted">
            Deactivated · {inactive.length}
          </summary>
          <div className="space-y-3">
            {inactive.map((p) => (
              <AccessRow
                key={p.id}
                p={p}
                actions={[{ label: "Reactivate", status: "active" }]}
              />
            ))}
          </div>
        </details>
      )}
    </Screen>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className="text-lg font-black leading-tight">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function AthleteCard({ r, today }: { r: DashboardRow; today: string }) {
  const p = r.profile;
  const fight = fightCountdown(p.next_fight_date, today);
  const limit =
    p.weight_class_limit_kg != null ? Number(p.weight_class_limit_kg) : null;
  const over =
    r.latestBodyweight != null && limit != null
      ? Math.round((r.latestBodyweight - limit) * 10) / 10
      : null;

  return (
    <Link href={`/coach/athlete/${p.id}`} className="block">
      <Card className="!p-4 hover:border-muted">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold">
              {p.full_name ?? p.email}
            </p>
            <p className="truncate text-sm text-muted">
              {[p.discipline?.name, p.weight_class]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
          <TrafficLight level={r.light} />
        </div>

        {(r.reasons.length > 0 || r.missedLastWeek) && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {r.reasons.map((x) => (
              <span
                key={x}
                className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold"
              >
                {x}
              </span>
            ))}
            {r.missedLastWeek && (
              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
                Last week not submitted
              </span>
            )}
          </div>
        )}
        {r.latestCheckin?.niggle && r.latestCheckin.niggle_note && (
          <p className="mb-3 text-sm">
            <span className="text-muted">Niggle: </span>
            {r.latestCheckin.niggle_note}
          </p>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
          <Stat
            label="Last week"
            value={r.lastWeek.load}
            sub={`${formatChange(r.changePct)} vs prev (${r.prevWeek.load})`}
          />
          <Stat
            label="This week"
            value={r.thisWeek.load}
            sub={`${r.thisWeek.count} session${r.thisWeek.count === 1 ? "" : "s"} so far`}
          />
          <Stat
            label="Wellness"
            value={r.lastCheckin ? `${r.lastCheckin.wellness}/10` : "–"}
            sub="last week"
          />
          <Stat
            label="Bodyweight"
            value={
              r.latestBodyweight != null ? `${r.latestBodyweight} kg` : "–"
            }
            sub={
              over != null
                ? over > 0
                  ? `${over} kg over limit`
                  : `${Math.abs(over)} kg under`
                : limit
                  ? `limit ${limit} kg`
                  : undefined
            }
          />
          <Stat
            label="Fight"
            value={
              fight
                ? fight.past
                  ? "Passed"
                  : fight.label.replace(" out", "")
                : "–"
            }
            sub={p.next_fight_date ? formatDate(p.next_fight_date) : undefined}
          />
        </div>
      </Card>
    </Link>
  );
}

function AccessRow({
  p,
  actions,
}: {
  p: Profile;
  actions: { label: string; status: AccountStatus; primary?: boolean }[];
}) {
  return (
    <Card className="flex flex-col gap-3 !p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-extrabold">{p.full_name ?? "(no name)"}</p>
        <p className="truncate text-sm text-muted">{p.email}</p>
        {!p.consent_accepted_at ? (
          <p className="mt-1 text-xs text-warn">
            Hasn&apos;t accepted consent yet
          </p>
        ) : !p.profile_completed_at ? (
          <p className="mt-1 text-xs text-warn">
            Hasn&apos;t finished profile yet
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        {actions.map((a) => (
          <form key={a.label} action={setAthleteStatus}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="status" value={a.status} />
            <button
              className={`min-h-11 rounded-xl px-4 text-sm font-extrabold uppercase tracking-wide ${
                a.primary
                  ? "bg-brand text-white"
                  : "border border-line bg-surface-2 text-text"
              }`}
            >
              {a.label}
            </button>
          </form>
        ))}
      </div>
    </Card>
  );
}
