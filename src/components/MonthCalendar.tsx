"use client";
// Client's month view: dots per day, tap a day to see its workouts.
// Move a workout: drag its handle onto another day, or tap the handle then tap a day.
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { moveMyWorkout } from "@/app/train/own-actions";

export type DayStatus = "done" | "partial" | "missed" | "planned";
export interface MonthWorkout {
  id: string;
  date: string;
  title: string;
  status: DayStatus;
}

const DOT: Record<DayStatus, string> = { done: "bg-ok", partial: "bg-warn", missed: "bg-brand", planned: "bg-text/70" };
const LABEL: Record<DayStatus, string> = { done: "Done", partial: "Started", missed: "Not logged", planned: "Planned" };
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(s + "T00:00:00Z");

function monthGrid(first: string) {
  const start = utc(first);
  const lead = (start.getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let i = 0; i < days; i++) cells.push(iso(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1 + i))));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function MonthCalendar({
  months,
  today,
  workouts: initial,
  min,
  max,
  locked = false,
}: {
  months: { first: string; label: string }[];
  today: string;
  workouts: MonthWorkout[];
  min?: string;
  max?: string;
  locked?: boolean;
}) {
  const router = useRouter();
  const [workouts, setWorkouts] = useState(initial);
  useEffect(() => setWorkouts(initial), [initial]);
  const [m, setM] = useState(0);
  const byDay = new Map<string, MonthWorkout[]>();
  for (const w of workouts) byDay.set(w.date, [...(byDay.get(w.date) ?? []), w]);
  const firstAhead = initial.filter((w) => w.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]?.date;
  const [sel, setSel] = useState<string>(initial.some((w) => w.date === today) ? today : firstAhead ?? today);
  const [picked, setPicked] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; over: string | null } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const startPt = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const canMoveTo = (d: string) => !!min && !!max && d >= min && d <= max;
  const movable = (w: MonthWorkout) => !locked && !!min && w.status !== "done" && w.date >= min;

  function move(id: string, to: string) {
    const w = workouts.find((x) => x.id === id);
    setPicked(null);
    if (!w || w.date === to) return;
    if (!canMoveTo(to)) return setMsg({ ok: false, text: "Pick a day from last week to 4 weeks ahead." });
    const before = workouts;
    setWorkouts((ws) => ws.map((x) => (x.id === id ? { ...x, date: to, status: to < today ? "missed" : "planned" } : x)));
    setSel(to);
    start(async () => {
      const r = await moveMyWorkout(id, to).catch(() => ({ ok: false as const, error: "No connection. It didn't move." }));
      if (!r.ok) {
        setWorkouts(before);
        setMsg({ ok: false, text: r.error });
      } else {
        setMsg({ ok: true, text: `${w.title} moved.` });
        router.refresh();
      }
    });
  }

  const dayAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-day]")?.dataset.day ?? null;
  const handle = (w: MonthWorkout) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      startPt.current = { x: e.clientX, y: e.clientY, moved: false };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = startPt.current;
      if (!s) return;
      if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8) return;
      s.moved = true;
      setDrag({ id: w.id, x: e.clientX, y: e.clientY, over: dayAt(e.clientX, e.clientY) });
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = startPt.current;
      startPt.current = null;
      if (!s) return;
      if (s.moved) {
        const d = dayAt(e.clientX, e.clientY);
        setDrag(null);
        if (d) move(w.id, d);
      } else setPicked((p) => (p === w.id ? null : w.id));
    },
    onPointerCancel: () => {
      startPt.current = null;
      setDrag(null);
    },
  });

  const cells = monthGrid(months[m].first);
  const list = byDay.get(sel) ?? [];
  const pickedW = workouts.find((w) => w.id === picked);
  const dragW = drag && workouts.find((w) => w.id === drag.id);
  const selLabel = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(utc(sel));

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Your plan</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setM((x) => Math.max(0, x - 1))} disabled={m === 0} aria-label="Previous month" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-24 text-center text-sm font-black uppercase">{months[m].label}</span>
          <button type="button" onClick={() => setM((x) => Math.min(months.length - 1, x + 1))} disabled={m === months.length - 1} aria-label="Next month" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {pickedW && <p className="mb-2 rounded-xl bg-brand/15 px-3 py-2 text-sm font-bold text-brand">Now tap the new day for {pickedW.title}.</p>}
      <div className="rounded-2xl border border-line bg-surface p-3">
        <div className="grid grid-cols-7 text-center text-[11px] font-bold text-muted">
          {DOW.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const ws = byDay.get(d) ?? [];
            const isSel = d === sel && !picked;
            const target = (picked || drag) && canMoveTo(d);
            const over = drag?.over === d;
            return (
              <button
                key={d}
                type="button"
                data-day={d}
                onClick={() => (picked ? move(picked, d) : setSel(d))}
                aria-label={`${d}${ws.length ? `, ${ws.length} workout${ws.length > 1 ? "s" : ""}` : ""}`}
                aria-pressed={isSel}
                className={`mx-auto flex h-11 w-10 flex-col items-center justify-center rounded-xl text-sm ${
                  over ? "bg-brand text-white" : isSel ? "bg-text font-black text-ink" : target ? "bg-surface-2 font-bold" : d === today ? "font-black text-brand" : ws.length ? "font-bold" : "text-muted/60"
                }`}
              >
                {Number(d.slice(8))}
                <span className="mt-0.5 flex h-1.5 gap-0.5">
                  {ws.slice(0, 3).map((w) => <span key={w.id} className={`h-1.5 w-1.5 rounded-full ${isSel && w.status === "planned" ? "bg-ink/60" : DOT[w.status]}`} />)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px] text-muted">
          {(["done", "planned", "missed"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${DOT[k]}`} />{LABEL[k]}</span>
          ))}
        </div>
      </div>
      <div className="mt-2">
        <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-widest text-muted">{sel === today ? "Today" : selLabel}</p>
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-3 text-center text-sm text-muted">Rest day</p>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {list.map((w) => (
              <div key={w.id} className={`flex min-h-12 items-center ${w.id === picked ? "bg-brand/10" : ""} ${drag?.id === w.id ? "opacity-40" : ""}`}>
                {movable(w) ? (
                  <button
                    type="button"
                    {...handle(w)}
                    aria-label={`Move ${w.title}`}
                    className="flex h-12 w-10 shrink-0 cursor-grab select-none items-center justify-center text-muted"
                    style={{ touchAction: "none" }}
                  >
                    <GripVertical size={18} />
                  </button>
                ) : (
                  <span className="w-3" />
                )}
                <Link href={`/train/${w.id}`} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 pr-3 active:bg-surface-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[w.status]}`} />
                  <span className="min-w-0 flex-1 truncate font-extrabold uppercase">{w.title}</span>
                  <span className="text-xs text-muted">{LABEL[w.status]}</span>
                  <span className="text-muted" aria-hidden>›</span>
                </Link>
              </div>
            ))}
          </div>
        )}
        {!locked && list.some(movable) && !picked && <p className="mt-1 px-1 text-[11px] text-muted">To move a session, drag its handle onto a day, or tap the handle then tap a day.</p>}
        {locked && <p className="mt-1 px-1 text-[11px] text-muted">Moving is off while you view the app as this client.</p>}
        {msg && <p className={`mt-1 px-1 text-sm font-bold ${msg.ok ? "text-ok" : "text-brand"}`}>{msg.text}{pending ? "…" : ""}</p>}
      </div>
      {drag && dragW && (
        <div className="pointer-events-none fixed z-50 max-w-[80vw] -translate-x-1/2 -translate-y-1/2 truncate rounded-xl border border-brand bg-surface px-3 py-2 text-sm font-extrabold uppercase shadow-lg" style={{ left: drag.x, top: drag.y }}>
          {dragW.title}
        </div>
      )}
    </section>
  );
}
