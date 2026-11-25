"use client";
// Small home-screen weigh-in: today's number in one tap, with the last few days for context.
import { useState, useTransition } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { quickWeight } from "@/app/train/progress-actions";
import { actionErrorMessage, needsReload } from "@/lib/action-error";

export function QuickWeight({ today, last, week }: { today: number | null; last: { kg: number; label: string } | null; week: number | null }) {
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState(today ? String(today) : "");
  const [saved, setSaved] = useState<number | null>(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mb-5 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <Scale size={20} className="shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{saved ? `Today: ${saved} kg` : "Weigh in today"}</p>
          <p className="text-xs text-muted">
            {last ? `Last: ${last.kg} kg (${last.label})` : "Same time each morning gives the clearest trend."}
            {week != null && ` · 7-day avg ${week} kg`}
          </p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="min-h-10 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold">
            {saved ? "Edit" : "Log"}
          </button>
        )}
      </div>
      {open && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              let r: Awaited<ReturnType<typeof quickWeight>>;
              try {
                r = await quickWeight(kg);
              } catch (err) {
                setError(actionErrorMessage(err));
                return;
              }
              if (!r.ok) setError(r.error);
              else {
                setSaved(Math.round(Number(kg.replace(",", ".")) * 10) / 10);
                setOpen(false);
              }
            });
          }}
        >
          <input
            autoFocus
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            inputMode="decimal"
            placeholder="kg"
            aria-label="Bodyweight in kg"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-center text-lg font-bold text-text focus:border-brand focus:outline-none"
          />
          <button disabled={pending} className="min-h-12 rounded-xl bg-brand px-5 font-extrabold uppercase text-white disabled:opacity-60">
            {pending ? "…" : "Save"}
          </button>
        </form>
      )}
      {error && (
        <p className="mt-1 text-sm font-bold text-brand">
          {error}{" "}
          {needsReload(error) && <button type="button" onClick={() => window.location.reload()} className="underline">Reload</button>}
        </p>
      )}
      <Link href="/bodyweight" className="mt-2 block text-right text-xs font-bold text-muted underline underline-offset-4">See trend</Link>
    </div>
  );
}
