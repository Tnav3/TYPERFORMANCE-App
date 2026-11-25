"use client";
// Client's week board: drag a workout by its handle to another day, or tap the
// handle then tap a day. Works with a finger (pointer events) and a mouse.
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { moveMyWorkout } from "@/app/train/own-actions";

export interface BoardWorkout {
  id: string;
  title: string;
  date: string;
  done: boolean;
}

export function WeekBoard({
  weeks,
  today,
  min,
  max,
  workouts: initial,
  locked,
}: {
  weeks: { label: string; days: { iso: string; dow: string; day: string }[] }[];
  today: string;
  min: string;
  max: string;
  workouts: BoardWorkout[];
  locked: boolean;
}) {
  const router = useRouter();
  const [workouts, setWorkouts] = useState(initial);
  useEffect(() => setWorkouts(initial), [initial]);
  const [wk, setWk] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; over: string | null } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const startPt = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const can = (iso: string) => iso >= min && iso <= max;
  const move = (id: string, iso: string) => {
    const w = workouts.find((x) => x.id === id);
    setPicked(null);
    if (!w || w.date === iso) return;
    if (!can(iso)) return setMsg({ ok: false, text: "Pick a day from last week to 4 weeks ahead." });
    const before = workouts;
    setWorkouts((ws) => ws.map((x) => (x.id === id ? { ...x, date: iso } : x)));
    start(async () => {
      const r = await moveMyWorkout(id, iso).catch(() => ({ ok: false as const, error: "No connection. It didn't move." }));
      if (!r.ok) {
        setWorkouts(before);
        setMsg({ ok: false, text: r.error });
      } else {
        setMsg({ ok: true, text: `${w.title} moved.` });
        router.refresh();
      }
    });
  };

  const dayAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-day]")?.dataset.day ?? null;

  const handle = (w: BoardWorkout) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (locked || w.done) return;
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
        const iso = dayAt(e.clientX, e.clientY);
        setDrag(null);
        if (iso) move(w.id, iso);
      } else setPicked((p) => (p === w.id ? null : w.id));
    },
    onPointerCancel: () => {
      startPt.current = null;
      setDrag(null);
    },
  });

  const week = weeks[wk];
  const pickedW = workouts.find((w) => w.id === picked);
  const dragW = drag && workouts.find((w) => w.id === drag.id);

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Plan your week</h2>
        <div className="flex rounded-xl border border-line p-0.5 text-xs font-bold">
          {weeks.map((w, i) => (
            <button key={w.label} type="button" onClick={() => setWk(i)} className={`min-h-8 rounded-lg px-3 ${i === wk ? "bg-text text-ink" : "text-muted"}`}>
              {w.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-xs text-muted">
        {locked
          ? "Moving is off while you view the app as this client."
          : pickedW
            ? `Now tap the day for "${pickedW.title}".`
            : "Drag a workout by its handle to another day, or tap the handle then tap a day."}
      </p>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {week.days.map((d) => {
          const ws = workouts.filter((w) => w.date === d.iso);
          const target = (picked || drag) && can(d.iso);
          const over = drag?.over === d.iso;
          return (
            <div
              key={d.iso}
              data-day={d.iso}
              onClick={() => picked && move(picked, d.iso)}
              className={`flex min-h-14 items-center gap-3 px-3 py-2 transition-colors ${over ? "bg-brand/15" : target ? "bg-surface-2" : ""} ${picked && target ? "cursor-pointer" : ""}`}
            >
              <div className={`w-11 shrink-0 text-center leading-tight ${d.iso === today ? "text-brand" : "text-muted"}`}>
                <span className="block text-[11px] font-bold uppercase">{d.dow}</span>
                <span className="block text-sm font-black">{d.day}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {ws.length === 0 && <span className="text-sm text-muted/60">{picked && target ? "Tap to move here" : "Rest"}</span>}
                {ws.map((w) => (
                  <div
                    key={w.id}
                    className={`flex min-h-10 max-w-full items-center rounded-xl border ${w.id === picked ? "border-brand bg-brand/10" : w.done ? "border-ok/40 bg-ok/10" : "border-line bg-surface-2"} ${drag?.id === w.id ? "opacity-40" : ""}`}
                  >
                    {!w.done && !locked && (
                      <button
                        type="button"
                        {...handle(w)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Move ${w.title}`}
                        className="flex h-10 w-8 shrink-0 cursor-grab select-none items-center justify-center text-muted active:cursor-grabbing"
                        style={{ touchAction: "none" }}
                      >
                        <GripVertical size={16} />
                      </button>
                    )}
                    <Link href={`/train/${w.id}`} onClick={(e) => picked && (e.preventDefault(), e.stopPropagation(), move(picked, d.iso))} className={`truncate py-2 pr-3 text-sm font-extrabold uppercase ${w.done || locked ? "pl-3" : ""}`}>
                      {w.title}
                      {w.done && <span className="ml-1.5 text-ok">✓</span>}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {msg && <p className={`mt-2 text-sm font-bold ${msg.ok ? "text-ok" : "text-brand"}`}>{msg.text}{pending ? "…" : ""}</p>}
      {drag && dragW && (
        <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-brand bg-surface px-3 py-2 text-sm font-extrabold uppercase max-w-[80vw] truncate shadow-lg" style={{ left: drag.x, top: drag.y }}>
          {dragW.title}
        </div>
      )}
    </section>
  );
}
