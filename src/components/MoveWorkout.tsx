"use client";
// Client moves a workout to another day: quick day chips, or any date in the window.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { moveMyWorkout } from "@/app/train/own-actions";

export function MoveWorkout({ id, from, days, min, max }: { id: string; from: string; days: { iso: string; label: string }[]; min: string; max: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = (iso: string) =>
    start(async () => {
      setError(null);
      const r = await moveMyWorkout(id, iso);
      if (!r.ok) setError(r.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-9 items-center gap-1.5 text-sm font-bold text-muted hover:text-text">
        <CalendarClock size={15} /> Move
      </button>
    );
  return (
    <div className="mt-2 w-full">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted">Move to</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.filter((d) => d.iso !== from).map((d) => (
          <button key={d.iso} type="button" disabled={pending} onClick={() => go(d.iso)} className="min-h-10 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold disabled:opacity-50">
            {d.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input type="date" min={min} max={max} aria-label="Other date" onChange={(e) => e.target.value && go(e.target.value)} className="min-h-10 rounded-xl border border-line bg-surface-2 px-2 text-sm text-text" />
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 px-2 text-sm text-muted">Cancel</button>
      </div>
      {error && <p className="mt-1 text-sm font-bold text-brand">{error}</p>}
    </div>
  );
}
