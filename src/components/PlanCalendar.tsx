"use client";
// Client planner: week (with exercises) or month view. Tap "+" to build a workout on that day,
// drag a workout to move it (hold Alt/Option to copy), drag a program onto a day to start it there.
// On touch screens: tap a program, then tap a day.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GripVertical, Plus } from "lucide-react";
import { addWorkout } from "@/app/coach/workouts/actions";
import { assignProgramOn, copyWorkout, moveWorkout } from "@/app/coach/athlete/[id]/program/actions";
import type { CalStatus } from "@/components/WorkoutCalendar";

export interface PlanWorkout {
  id: string;
  date: string;
  title: string;
  status: CalStatus;
  group: boolean;
  note?: string;
  lines: string[];
}
export interface PlanProgram {
  id: string;
  name: string;
  weeks: number;
  master: boolean;
}

const DOT: Record<CalStatus, string> = { done: "bg-ok", partial: "bg-warn", missed: "bg-brand", planned: "bg-muted/50" };
const LABEL: Record<CalStatus, string> = { done: "Done", partial: "Started", missed: "Missed", planned: "Planned" };
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-AU", { ...o, timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

export function PlanCalendar({
  athleteId,
  view,
  days,
  month,
  today,
  workouts,
  programs,
  back,
  nav,
}: {
  athleteId: string;
  view: "week" | "month";
  days: string[];
  month?: string; // YYYY-MM in month view
  today: string;
  workouts: PlanWorkout[];
  programs: PlanProgram[];
  back: string;
  nav: { prev: string; next: string; today: string; week: string; month: string; label: string };
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [picked, setPicked] = useState<PlanProgram | null>(null); // tap-to-place on phones
  const [confirm, setConfirm] = useState<{ program: PlanProgram; date: string } | null>(null);

  const byDate = new Map<string, PlanWorkout[]>();
  for (const w of workouts) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      router.refresh();
    });

  const onDrop = (date: string, e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    try {
      const d = JSON.parse(e.dataTransfer.getData("text/plain")) as { k: "w" | "p"; id: string };
      if (d.k === "w") {
        const w = workouts.find((x) => x.id === d.id);
        if (!w || w.date === date) return;
        run(() => (e.altKey ? copyWorkout(athleteId, d.id, date) : moveWorkout(athleteId, d.id, date)));
      } else {
        const p = programs.find((x) => x.id === d.id);
        if (p) setConfirm({ program: p, date });
      }
    } catch {
      /* not ours */
    }
  };
  const dayProps = (date: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (over !== date) setOver(date);
    },
    onDragLeave: () => setOver((o) => (o === date ? null : o)),
    onDrop: (e: React.DragEvent) => onDrop(date, e),
    onClick: picked
      ? () => {
          setConfirm({ program: picked, date });
          setPicked(null);
        }
      : undefined,
  });
  const drag = (k: "w" | "p", id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({ k, id }));
      e.dataTransfer.effectAllowed = "copyMove";
    },
  });

  const AddBtn = ({ date, big }: { date: string; big?: boolean }) => (
    <form action={addWorkout} onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="target" value={`a:${athleteId}`} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="title" value="Workout" />
      <button
        className={
          big
            ? "flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-line text-xs font-bold text-muted hover:border-brand hover:text-brand"
            : "flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-brand"
        }
        aria-label={`Add workout on ${date}`}
        title="Build a workout on this day"
      >
        <Plus size={big ? 14 : 16} />
        {big && "Add workout"}
      </button>
    </form>
  );

  const Chip = ({ w, full }: { w: PlanWorkout; full: boolean }) => (
    <div
      {...(w.group ? {} : drag("w", w.id))}
      className={`group rounded-lg border border-line bg-surface-2 ${w.group ? "" : "cursor-grab active:cursor-grabbing"}`}
      title={w.group ? "Group workout" : "Drag to move · hold Alt/Option to copy"}
    >
      <Link href={`/coach/workouts/${w.id}`} className="block px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[w.status]}`} aria-label={LABEL[w.status]} />
          <span className={`min-w-0 flex-1 truncate font-bold text-text ${full ? "text-sm" : "text-[11px]"}`}>{w.title}</span>
          {full && !w.group && <GripVertical size={14} className="hidden shrink-0 text-muted lg:block" aria-hidden />}
        </span>
        {full && (w.note || w.lines.length > 0) && (
          <span className="mt-1 block space-y-0.5 text-[11px] leading-snug text-muted">
            {w.note && <span className="block font-semibold text-warn">{w.note}</span>}
            {w.lines.slice(0, 8).map((l, i) => (
              <span key={i} className="block truncate">{l}</span>
            ))}
            {w.lines.length > 8 && <span className="block">+{w.lines.length - 8} more</span>}
          </span>
        )}
        {full && w.lines.length === 0 && !w.note && <span className="mt-1 block text-[11px] text-brand">Empty – tap to add exercises</span>}
      </Link>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-4">
      {/* Programs to drag in */}
      <aside className="mb-4 lg:mb-0">
        <details className="rounded-2xl border border-line bg-surface lg:sticky lg:top-4" open>
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-extrabold uppercase tracking-wide">Programs</summary>
          <div className="border-t border-line p-2">
            <p className="mb-2 px-1 text-xs text-muted">
              <span className="hidden lg:inline">Drag one onto a day to start it there.</span>
              <span className="lg:hidden">Tap one, then tap the start day.</span>
            </p>
            {programs.length === 0 && <p className="px-1 text-sm text-muted">No programs yet.</p>}
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {programs.map((p) => (
                <button
                  key={p.id}
                  {...drag("p", p.id)}
                  onClick={() => setPicked(picked?.id === p.id ? null : p)}
                  className={`flex w-full cursor-grab items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm active:cursor-grabbing ${
                    picked?.id === p.id ? "border-brand bg-brand/15" : "border-line bg-surface-2 hover:border-muted"
                  }`}
                >
                  <GripVertical size={14} className="shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{p.name}</span>
                    <span className="block text-[11px] text-muted">
                      {p.weeks} wk{p.master ? " · template" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <Link href="/coach/programs" className="mt-2 block px-1 text-xs font-bold text-brand">
              Build a new program →
            </Link>
          </div>
        </details>
      </aside>

      <div>
        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-line">
            <Link href={nav.prev} className="flex h-11 w-11 items-center justify-center text-lg text-muted hover:text-text" aria-label="Previous">‹</Link>
            <Link href={nav.today} className="flex h-11 items-center px-3 text-sm font-bold text-muted hover:text-text">Today</Link>
            <Link href={nav.next} className="flex h-11 w-11 items-center justify-center text-lg text-muted hover:text-text" aria-label="Next">›</Link>
          </div>
          <p className="flex-1 font-black uppercase tracking-tight">{nav.label}</p>
          <div className="flex rounded-xl border border-line p-1 text-sm font-bold">
            {(["week", "month"] as const).map((v) => (
              <Link key={v} href={v === "week" ? nav.week : nav.month} className={`min-h-9 content-center rounded-lg px-4 capitalize ${view === v ? "bg-brand text-white" : "text-muted"}`}>
                {v}
              </Link>
            ))}
          </div>
        </div>

        {picked && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-brand bg-brand/10 px-3 py-2 text-sm">
            <span>
              Tap the day <b>{picked.name}</b> should start.
            </span>
            <button onClick={() => setPicked(null)} className="min-h-9 rounded-lg px-3 font-bold text-muted">Cancel</button>
          </div>
        )}
        {error && <p className="mb-3 rounded-xl border border-brand/50 bg-brand/10 px-3 py-2 text-sm">{error}</p>}

        {view === "week" ? (
          <div className={`grid gap-2 lg:grid-cols-7 ${busy ? "opacity-60" : ""}`}>
            {days.map((date) => {
              const list = byDate.get(date) ?? [];
              return (
                <div
                  key={date}
                  {...dayProps(date)}
                  className={`flex min-h-24 flex-col gap-1.5 rounded-xl border p-2 transition-colors lg:min-h-64 ${
                    over === date ? "border-brand bg-brand/10" : date === today ? "border-brand/60 bg-surface" : "border-line bg-surface"
                  } ${picked ? "cursor-pointer" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-bold uppercase tracking-wide ${date === today ? "text-brand" : "text-muted"}`}>
                      {fmt(date, { weekday: "short" })} <span className="text-text">{fmt(date, { day: "numeric" })}</span>
                    </p>
                    {list.length > 0 && <AddBtn date={date} />}
                  </div>
                  {list.map((w) => (
                    <Chip key={w.id} w={w} full />
                  ))}
                  {list.length === 0 && (
                    <div className="mt-auto">
                      <AddBtn date={date} big />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={busy ? "opacity-60" : ""}>
            <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-bold uppercase tracking-wide text-muted">
              {DOW.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((date) => {
                const list = byDate.get(date) ?? [];
                const inMonth = !month || date.startsWith(month);
                return (
                  <div
                    key={date}
                    {...dayProps(date)}
                    className={`group/day relative flex min-h-20 flex-col gap-0.5 rounded-lg border p-1 sm:min-h-28 ${
                      over === date ? "border-brand bg-brand/10" : date === today ? "border-brand/60" : "border-line"
                    } ${inMonth ? "bg-surface" : "bg-transparent opacity-50"} ${picked ? "cursor-pointer" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${date === today ? "text-brand" : "text-muted"}`}>{fmt(date, { day: "numeric" })}</span>
                      <span className="opacity-100 lg:opacity-0 lg:group-hover/day:opacity-100">
                        <AddBtn date={date} />
                      </span>
                    </div>
                    {list.slice(0, 3).map((w) => (
                      <Chip key={w.id} w={w} full={false} />
                    ))}
                    {list.length > 3 && <span className="text-[10px] text-muted">+{list.length - 3}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
          {(Object.keys(DOT) as CalStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${DOT[s]}`} /> {LABEL[s]}
            </span>
          ))}
          <span className="hidden lg:inline">· Drag to move · Alt/Option-drag to copy</span>
        </p>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5">
            <p className="text-lg font-black uppercase leading-tight tracking-tight">Start {confirm.program.name}?</p>
            <p className="mt-2 text-sm text-muted">
              Week 1 Day 1 lands on {fmt(confirm.date, { weekday: "long", day: "numeric", month: "long" })}. It runs {confirm.program.weeks} week
              {confirm.program.weeks === 1 ? "" : "s"}. Nothing already on the calendar is removed.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirm(null)} className="min-h-12 rounded-xl border border-line font-bold">Cancel</button>
              <button
                onClick={() => {
                  const c = confirm;
                  setConfirm(null);
                  run(() => assignProgramOn(athleteId, c.program.id, c.date));
                }}
                className="min-h-12 rounded-xl bg-brand font-extrabold uppercase tracking-wide text-white"
              >
                Start it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
