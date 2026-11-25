// Client home screen (display only): Today, To do, This week, tab bar.
import Link from "next/link";
import { MiniChart } from "./MiniChart";
import { Avatar } from "./Avatar";
import { QuickWeight } from "./QuickWeight";
import type { ReactNode } from "react";
import { Bell } from "lucide-react";
import { ClientTabBar } from "@/components/ClientTabBar";
import { Logo, Screen } from "@/components/ui";

export interface HomeProps {
  tour: ReactNode;
  camp?: ReactNode;
  team?: ReactNode;
  quote?: { body: string; author: string | null; source?: string | null } | null;
  card?: { overall: number | null; tier: "rookie" | "bronze" | "silver" | "gold" | "elite"; stats: Record<string, number | null>; seen: number | null } | null;
  first: string;
  me: { name: string; avatar: string | null; nickname: string | null; goal: string | null };
  fightLabel: string | null;
  unreadNotes: number;
  programOn: boolean;
  today: string;
  todayWorkouts: { id: string; title: string; done: boolean; exercises: number; mins: number }[];
  next: { date: string; title: string } | null;
  todo: { href: string; title: string; sub: string; tone: "warn" | "brand" | "plain" }[];
  showTodo: boolean;
  weight: { today: number | null; last: { kg: number; label: string } | null; week: number | null } | null;
  booking: { label: string; cadence: string | null } | null;
  trend: { title: string; message: string | null; latest: string; kind: "bars" | "line"; points: { label: string; value: number | null }[] } | null;
  week: { days: { date: string; st: "done" | "missed" | "planned" | "rest" }[]; done: number; total: number } | null;
  empty: boolean;
  tabs: { train: boolean; chat: boolean; progress: boolean; chatBadge: number; moreBadge: number; food?: string | null };
}

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

const TIER_STYLE: Record<NonNullable<HomeProps["card"]>["tier"], { label: string; ring: string; next: number | null; nextLabel: string | null }> = {
  rookie: { label: "Rookie", ring: "from-zinc-400 to-zinc-700", next: 60, nextLabel: "Bronze" },
  bronze: { label: "Bronze", ring: "from-amber-500 to-orange-800", next: 70, nextLabel: "Silver" },
  silver: { label: "Silver", ring: "from-slate-200 to-slate-500", next: 80, nextLabel: "Gold" },
  gold: { label: "Gold", ring: "from-yellow-200 to-amber-500", next: 88, nextLabel: "Elite" },
  elite: { label: "Elite", ring: "from-[#D2141E] to-[#282828]", next: null, nextLabel: null },
};

/** Slim player card on home: rating, tier, next tier, and a nudge when it goes up. */
function CardStrip({ card }: { card: NonNullable<HomeProps["card"]> }) {
  const t = TIER_STYLE[card.tier];
  const up = card.overall != null && card.seen != null && card.overall > card.seen;
  const toNext = card.overall != null && t.next != null ? Math.max(1, t.next - card.overall) : null;
  const pct = card.overall == null ? 0 : Math.min(100, Math.round(((card.overall - 40) / (99 - 40)) * 100));
  return (
    <Link href="/trophies" className={`mb-5 flex items-center gap-3 rounded-2xl border p-3 ${up ? "border-brand bg-brand/10" : "border-line bg-surface"}`}>
      <span className={`relative shrink-0 rounded-xl bg-gradient-to-br p-[2px] ${t.ring}`}>
        <span className="flex h-12 w-12 flex-col items-center justify-center rounded-[10px] bg-ink">
          <span className="text-lg font-black leading-none">{card.overall ?? "–"}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted">OVR</span>
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-widest text-muted">
          Player card · <span className="text-text">{t.label}</span>
        </span>
        <span className="block truncate font-extrabold leading-tight">
          {up
            ? `Your card went up: ${card.seen} → ${card.overall}`
            : card.overall == null
              ? "Test 2 qualities to unlock your rating"
              : toNext
                ? `${toNext} to ${t.nextLabel}`
                : "Top tier. Hold it."}
        </span>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
          <span className={`block h-full rounded-full bg-gradient-to-r ${t.ring}`} style={{ width: `${pct}%` }} />
        </span>
      </span>
      <span className="text-muted" aria-hidden>›</span>
    </Link>
  );
}

export function ClientHome(p: HomeProps) {
  const allDone = p.todayWorkouts.length > 0 && p.todayWorkouts.every((w) => w.done);
  return (
    <Screen>
      {p.tour}
      <header className="mb-4 flex items-center gap-3">
        <Link href="/profile#about" aria-label="My profile">
          {p.me.avatar ? <Avatar name={p.me.name} path={p.me.avatar} /> : <Logo size={36} />}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black uppercase leading-tight tracking-tight">Hey {p.first}</p>
          {p.me.nickname && <p className="truncate text-xs font-bold text-muted">&ldquo;{p.me.nickname}&rdquo;</p>}
          {p.fightLabel && <p className="text-xs font-bold text-brand">Fight in {p.fightLabel}</p>}
        </div>
        <Link
          href="/notifications"
          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-line text-muted"
          aria-label={p.unreadNotes ? `${p.unreadNotes} new notifications` : "Notifications"}
        >
          <Bell size={20} />
          {p.unreadNotes ? (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-brand px-1.5 text-center text-[11px] font-black leading-5 text-white">{p.unreadNotes}</span>
          ) : null}
        </Link>
      </header>

      {p.camp}
      {p.programOn && (
        <Link href={p.todayWorkouts.length === 1 ? `/train/${p.todayWorkouts[0].id}` : "/train"} className="mb-5 block">
          <div className="rounded-3xl border border-brand bg-brand/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">Today</p>
            {p.todayWorkouts.length ? (
              p.todayWorkouts.map((w) => (
                <div key={w.id} className="mt-1">
                  <p className="flex items-center justify-between gap-2 text-2xl font-black uppercase leading-tight tracking-tight">
                    {w.title}
                    {w.done && <span className="shrink-0 rounded-full bg-ok/15 px-3 py-1 text-xs font-bold normal-case text-ok">Done ✓</span>}
                  </p>
                  {w.exercises > 0 && (
                    <p className="text-sm text-muted">
                      {w.exercises} exercise{w.exercises === 1 ? "" : "s"} · ~{w.mins} min
                    </p>
                  )}
                </div>
              ))
            ) : (
              <>
                <p className="mt-1 text-2xl font-black uppercase leading-tight tracking-tight">Rest day</p>
                {p.next && (
                  <p className="text-sm text-muted">
                    Next: {p.next.date} · {p.next.title}
                  </p>
                )}
              </>
            )}
            <p className="mt-4 flex min-h-14 items-center justify-center rounded-2xl bg-brand text-lg font-black uppercase tracking-wide text-white">
              {p.todayWorkouts.length && !allDone ? "Start workout" : "See my plan"}
            </p>
          </div>
        </Link>
      )}

      {p.showTodo && (
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">To do</h2>
          {p.todo.length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface px-4 py-3.5 font-bold text-ok">All done ✓</p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {p.todo.map((t) => (
                <Link key={t.href} href={t.href} className="flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-surface-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.tone === "warn" ? "bg-warn" : t.tone === "brand" ? "bg-brand" : "bg-muted/60"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold leading-tight">{t.title}</span>
                    <span className="block text-sm text-muted">{t.sub}</span>
                  </span>
                  <span className="text-muted" aria-hidden>
                    ›
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {p.week && (
        <Link href="/train" className="mb-5 block rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">This week</h2>
            <span className="text-sm">
              <b className="font-black">{p.week.done}</b>
              <span className="text-muted"> of {p.week.total} done</span>
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {p.week.days.map((d, i) => (
              <div key={d.date}>
                <span className={`block text-[11px] font-bold ${d.date === p.today ? "text-brand" : "text-muted"}`}>{DOW[i]}</span>
                <span
                  className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                    d.st === "done"
                      ? "bg-ok text-ink"
                      : d.st === "missed"
                        ? "border-2 border-brand/70 text-brand"
                        : d.st === "planned"
                          ? "border-2 border-line text-text"
                          : "text-muted/40"
                  } ${d.date === p.today ? "ring-2 ring-brand ring-offset-2 ring-offset-surface" : ""}`}
                >
                  {d.st === "done" ? "✓" : d.st === "rest" ? "·" : ""}
                </span>
              </div>
            ))}
          </div>
        </Link>
      )}

      {p.card && <CardStrip card={p.card} />}
      {p.quote && (
        <figure className="relative mb-5 overflow-hidden rounded-2xl border border-line bg-surface px-4 pb-3.5 pt-4">
          <span aria-hidden className="pointer-events-none absolute -top-3 right-3 font-serif text-7xl font-black leading-none text-brand/20">&rdquo;</span>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">Today&apos;s fuel</p>
          <blockquote className="pr-6 text-base font-bold leading-snug">{p.quote.body}</blockquote>
          {p.quote.author && (
            <figcaption className="mt-2 text-xs">
              <span className="font-black uppercase tracking-wide text-brand">{p.quote.author}</span>
              {p.quote.source && <span className="text-muted"> · {p.quote.source}</span>}
            </figcaption>
          )}
        </figure>
      )}
      {p.team}
      {p.weight && <QuickWeight {...p.weight} />}

      {p.booking && (
        <Link href="/book" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
          <span className="min-w-0">
            <span className="block font-extrabold">{p.booking.label}</span>
            {p.booking.cadence && <span className="block text-sm text-muted">Included in your plan: {p.booking.cadence === "per_session" ? "book each session" : `${p.booking.cadence} catch-ups`}</span>}
          </span>
          <span className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-extrabold uppercase text-white">Book</span>
        </Link>
      )}

      {p.me.goal && (
        <Link href="/profile#about" className="mb-5 block rounded-2xl border border-line bg-surface px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">Your goal</span>
          <span className="block font-extrabold">{p.me.goal}</span>
        </Link>
      )}

      {p.trend && (
        <Link href="/train/history" className="mb-5 block rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Your trend</h2>
            <span className="text-sm font-black">{p.trend.latest}</span>
          </div>
          <p className="mt-1 font-extrabold">{p.trend.message ?? `${p.trend.title}: keep logging to see your trend`}</p>
          <MiniChart points={p.trend.points} kind={p.trend.kind} className="mt-3 !h-14" />
        </Link>
      )}

      {p.empty && <p className="rounded-2xl border border-line bg-surface p-4 text-muted">Your coach hasn&apos;t switched on any features for you yet.</p>}

      <ClientTabBar {...p.tabs} />
    </Screen>
  );
}
