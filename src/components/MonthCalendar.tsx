"use client";
// Compact month view for clients: dots per day, tap a day to see its workouts.
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

export function MonthCalendar({ months, today, workouts }: { months: { first: string; label: string }[]; today: string; workouts: MonthWorkout[] }) {
  const [m, setM] = useState(0);
  const byDay = new Map<string, MonthWorkout[]>();
  for (const w of workouts) byDay.set(w.date, [...(byDay.get(w.date) ?? []), w]);
  const firstAhead = workouts.filter((w) => w.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]?.date;
  const [sel, setSel] = useState<string>(byDay.has(today) ? today : firstAhead ?? today);
  const cells = monthGrid(months[m].first);
  const picked = byDay.get(sel) ?? [];
  const selLabel = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(utc(sel));

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Your month</h2>
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
      <div className="rounded-2xl border border-line bg-surface p-3">
        <div className="grid grid-cols-7 text-center text-[11px] font-bold text-muted">
          {DOW.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const ws = byDay.get(d) ?? [];
            const isSel = d === sel;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSel(d)}
                aria-label={`${d}${ws.length ? `, ${ws.length} workout${ws.length > 1 ? "s" : ""}` : ""}`}
                aria-pressed={isSel}
                className={`mx-auto flex h-11 w-10 flex-col items-center justify-center rounded-xl text-sm ${isSel ? "bg-text font-black text-ink" : d === today ? "font-black text-brand" : ws.length ? "font-bold" : "text-muted/60"}`}
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
        {picked.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-3 text-center text-sm text-muted">Rest day</p>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {picked.map((w) => (
              <Link key={w.id} href={`/train/${w.id}`} className="flex min-h-12 items-center gap-3 px-3 py-2 active:bg-surface-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[w.status]}`} />
                <span className="min-w-0 flex-1 truncate font-extrabold uppercase">{w.title}</span>
                <span className="text-xs text-muted">{LABEL[w.status]}</span>
                <span className="text-muted" aria-hidden>›</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
