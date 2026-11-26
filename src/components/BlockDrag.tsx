"use client";
// Drag a workout to another day on the client's block overview (desktop grid).
// Drop to move; hold Alt/Option while dropping to copy. Logged workouts stay put.
import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copyWorkout, moveWorkout } from "@/app/coach/athlete/[id]/program/actions";

type Ctx = {
  athleteId: string;
  over: string | null;
  setOver: (d: string | null) => void;
  drop: (date: string, e: React.DragEvent) => void;
  pending: boolean;
};
const DragCtx = createContext<Ctx | null>(null);
const MIME = "application/x-typ-workout";

export function BlockDrag({ athleteId, children }: { athleteId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const drop = (date: string, e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    let d: { id: string; date: string } | null = null;
    try {
      d = JSON.parse(e.dataTransfer.getData(MIME));
    } catch {
      return;
    }
    if (!d || d.date === date) return;
    const copy = e.altKey;
    const id = d.id;
    start(async () => {
      setError(null);
      const r = await (copy ? copyWorkout(athleteId, id, date) : moveWorkout(athleteId, id, date));
      if (r.error) setError(r.error);
      router.refresh();
    });
  };

  return (
    <DragCtx.Provider value={{ athleteId, over, setOver, drop, pending }}>
      {error && (
        <p role="alert" className="mb-2 rounded-xl border border-brand/50 bg-brand/10 px-3 py-2 text-sm font-semibold">
          {error}
        </p>
      )}
      <div className={pending ? "pointer-events-none opacity-70 transition-opacity" : undefined}>{children}</div>
    </DragCtx.Provider>
  );
}

/** Wraps a workout card. Only planned/missed (not logged) workouts can be dragged. */
export function DragCard({ id, date, locked, children }: { id: string; date: string; locked?: boolean; children: React.ReactNode }) {
  const ctx = useContext(DragCtx);
  if (!ctx || locked) return <>{children}</>;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(MIME, JSON.stringify({ id, date }));
        e.dataTransfer.effectAllowed = "copyMove";
      }}
      onDragEnd={() => ctx.setOver(null)}
      className="cursor-grab active:cursor-grabbing [&_a]:[-webkit-user-drag:none]"
      title="Drag to another day · hold Alt/Option to copy"
    >
      {children}
    </div>
  );
}

/** A day cell that accepts a dropped workout. */
export function DropDay({ date, className, children }: { date: string; className?: string; children: React.ReactNode }) {
  const ctx = useContext(DragCtx);
  if (!ctx) return <div className={className}>{children}</div>;
  const on = ctx.over === date;
  return (
    <div
      className={`${className ?? ""} ${on ? "ring-2 ring-brand ring-offset-1 ring-offset-surface" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = e.altKey ? "copy" : "move";
        if (ctx.over !== date) ctx.setOver(date);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) ctx.setOver(null);
      }}
      onDrop={(e) => ctx.drop(date, e)}
    >
      {children}
    </div>
  );
}
