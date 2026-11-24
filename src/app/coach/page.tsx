import Link from "next/link";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { fightCountdown } from "@/lib/fight";
import { getDashboard, type DashboardRow } from "@/lib/dashboard";
import { formatChange, LIGHT_ORDER } from "@/lib/load-metrics";
import { dayMonth } from "@/lib/week";
import type { AccountStatus, Profile } from "@/lib/types";
import { Card, Logo, Screen, SignOutButton } from "@/components/ui";
import { Activity, Dumbbell, MessageCircle, Users } from "lucide-react";
import { TrafficLight } from "@/components/TrafficLight";
import { CoachOverview } from "@/components/CoachOverview";
import { setAthleteStatus } from "./actions";
import { activityTone, byLeastRecent, lastSeenLabel } from "@/lib/activity";

export default async function CoachHome() {
  const { supabase, profile: me } = await requireState(["coach"]);
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

  const { count: unread } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .neq("sender_id", me.id)
    .is("read_at", null);

  const main: [string, string, React.ReactNode, number?][] = [
    ["/coach/programs", "Programs", <Dumbbell key="p" size={26} />],
    ["/coach/chat", "Inbox", <MessageCircle key="c" size={26} />, unread ?? 0],
    ["/coach/feed", "Workout Feed", <Activity key="f" size={26} />],
    ["/coach/groups", "Groups", <Users key="g" size={26} />],
  ];
  const more: [string, [string, string][]][] = [
    ["Programming", [["/coach/library", "Exercise library"], ["/coach/messages", "Scheduled messages"], ["/coach/sequences", "Onboarding sequences"], ["/coach/fights", "Competition tracker"]]],
    ["Clients & business", [["/coach/invites", "Invites & payments"], ["/notifications", "Phone notifications"], ["/coach/settings", "Settings"]]],
    ["Tools", [["/week", "Log my own training"], ["/calculator", "1RM calculator"], ["/mas", "MAS calculator"], ["/rpe", "RPE & RIR chart"], ["/hr", "HR zones"]]],
  ];

  return (
    <Screen wide>
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <h1 className="text-xl font-black uppercase tracking-tight">Dashboard</h1>
        </div>
        <SignOutButton />
      </header>

      {pending.length > 0 && (
        <Section title={`New sign-ups to approve · ${pending.length}`}>
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

      <nav className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {main.map(([href, label, icon, badge]) => (
          <Link
            key={href}
            href={href}
            className="relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-center transition-colors hover:border-brand"
          >
            <span className="text-brand">{icon}</span>
            <span className="text-sm font-extrabold uppercase tracking-wide">{label}</span>
            {badge ? (
              <span className="absolute right-3 top-3 rounded-full bg-brand px-2 py-0.5 text-xs font-black text-white">{badge}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      <CoachOverview
        supabase={supabase}
        today={today}
        hidden={((me as unknown as { dashboard_prefs?: { hidden?: string[] } }).dashboard_prefs?.hidden) ?? []}
        missedCheckins={rows
          .filter((r) => r.missedLastWeek)
          .map((r) => ({ id: r.profile.id, name: r.profile.full_name ?? r.profile.email }))}
      />

      <section className="mb-8" id="clients">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Clients · {sorted.length + noCheckin.length}
          </h2>
          {sorted.length > 0 && (
            <p className="text-xs text-muted">
              Week of {dayMonth(weeks.lastWeek)} · {counts.red} red · {counts.amber} amber · {counts.green} green
            </p>
          )}
        </div>
        {sorted.length + noCheckin.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
            No active clients yet. Share your sign-up link, then approve them above.
          </p>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {sorted.map((r) => (
              <ClientRow key={r.profile.id} r={r} today={today} />
            ))}
            {noCheckin.map((p) => (
              <Link key={p.id} href={`/coach/athlete/${p.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 hover:bg-surface-2">
                <span className="truncate font-bold">{p.full_name ?? p.email}</span>
                <span className="text-muted" aria-hidden>›</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <details className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface" open={false}>
        <summary className="flex min-h-14 cursor-pointer items-center justify-between px-4 font-extrabold uppercase tracking-wide">
          More <span className="text-sm font-semibold normal-case text-muted">Library, messages, invites, tools…</span>
        </summary>
        <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-3">
          {more.map(([title, links]) => (
            <div key={title}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
              {links.map(([href, label]) => (
                <Link key={href} href={href} className="flex min-h-11 items-center justify-between rounded-lg px-2 font-semibold hover:bg-surface-2">
                  {label} <span className="text-muted" aria-hidden>›</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </details>

      {activity.length > 0 && (
        <details className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface">
          <summary className="flex min-h-14 cursor-pointer items-center justify-between px-4 font-extrabold uppercase tracking-wide">
            <span>Last time clients opened the app</span>
            <span className="text-sm font-semibold normal-case text-muted">
              {activeWeek} of {activity.length} this week
            </span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {activity.map((a) => {
              const tone = activityTone(a.last_seen_at, now);
              return (
                <li key={a.id}>
                  <Link href={`/coach/athlete/${a.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 text-sm">
                    <span className="truncate font-bold">{a.full_name ?? "Unnamed"}</span>
                    <span className={`shrink-0 ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-brand"}`}>
                      {lastSeenLabel(a.last_seen_at, now)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {inactive.length > 0 && (
        <details className="mb-8">
          <summary className="mb-3 cursor-pointer px-1 text-xs font-semibold uppercase tracking-widest text-muted">
            Deactivated clients · {inactive.length}
          </summary>
          <div className="space-y-3">
            {inactive.map((p) => (
              <AccessRow key={p.id} p={p} actions={[{ label: "Reactivate", status: "active" }]} />
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

function ClientRow({ r, today }: { r: DashboardRow; today: string }) {
  const p = r.profile;
  const fight = fightCountdown(p.next_fight_date, today);
  const flags = [...r.reasons, ...(r.missedLastWeek ? ["Check-in missed"] : [])];
  const summary = flags.length
    ? flags.slice(0, 2).join(" · ")
    : [
        `Load ${r.lastWeek.load} (${formatChange(r.changePct)})`,
        r.lastCheckin ? `wellness ${r.lastCheckin.wellness}/10` : null,
        fight && !fight.past ? `fight ${fight.label.replace(" out", "")}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
  return (
    <Link href={`/coach/athlete/${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-surface-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold">{p.full_name ?? p.email}</p>
        <p className={`truncate text-sm ${flags.length ? "text-text" : "text-muted"}`}>{summary}</p>
      </div>
      <TrafficLight level={r.light} />
      <span className="text-muted" aria-hidden>›</span>
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
