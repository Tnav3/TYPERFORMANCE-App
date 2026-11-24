// Client home screen (display only): Today, To do, This week, tab bar.
import Link from "next/link";
import { MiniChart } from "./MiniChart";
import { Avatar } from "./Avatar";
import type { ReactNode } from "react";
import { Bell } from "lucide-react";
import { ClientTabBar } from "@/components/ClientTabBar";
import { Logo, Screen } from "@/components/ui";

export interface HomeProps {
  tour: ReactNode;
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
  trend: { title: string; message: string | null; latest: string; kind: "bars" | "line"; points: { label: string; value: number | null }[] } | null;
  week: { days: { date: string; st: "done" | "missed" | "planned" | "rest" }[]; done: number; total: number } | null;
  empty: boolean;
  tabs: { train: boolean; chat: boolean; progress: boolean; chatBadge: number; moreBadge: number; food?: string | null };
}

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

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
