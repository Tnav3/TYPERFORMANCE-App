"use client";
// Swap an exercise mid-workout: why → pick from similar ones (same movement pattern) or search.
import { useEffect, useState, useTransition } from "react";
import { PlayCircle, Search, X } from "lucide-react";
import { swapOptions, type SwapOption } from "@/app/train/exercise-actions";
import { swapExercise } from "@/app/train/actions";
import { SWAP_REASONS } from "@/lib/programming/types";

export function SwapSheet({
  workoutId,
  athleteId,
  itemId,
  exerciseId,
  name,
  onClose,
  onDone,
}: {
  workoutId: string;
  athleteId?: string;
  itemId: string;
  exerciseId: string;
  name: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<{ suggested: SwapOption[]; results: SwapOption[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      swapOptions(exerciseId, reason, q).then((r) => {
        if (!live) return;
        if (r.error) setError(r.error);
        else setOpts(r.data!);
      });
    }, q ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [exerciseId, reason, q]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const pick = (o: SwapOption) => {
    if (!reason) {
      setError("Pick a reason first.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await swapExercise({ workoutId, athleteId, itemId, exerciseId: o.id, reason, note });
      if (!r.ok) setError(r.error);
      else onDone();
    });
  };

  const list = q.trim().length >= 2 ? opts?.results ?? [] : opts?.suggested ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`Swap ${name}`}>
      <button className="absolute inset-0 bg-black/70" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface/95 px-5 py-3 backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Swap</p>
            <h2 className="truncate text-lg font-black uppercase leading-tight tracking-tight">{name}</h2>
          </div>
          <button onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted" aria-label="Close">
            <X size={22} />
          </button>
        </div>
        <div className="space-y-4 px-5 pt-4">
          <section>
            <h3 className="mb-2 text-sm font-bold">1. Why are you swapping?</h3>
            <div className="grid grid-cols-2 gap-2">
              {SWAP_REASONS.map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setReason(k)}
                  className={`min-h-11 rounded-xl border px-3 text-left text-sm font-bold ${reason === k ? "border-brand bg-brand text-white" : "border-line text-text"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {(reason === "pain" || reason === "other") && (
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                placeholder={reason === "pain" ? "Where does it hurt? Your coach will see this." : "Anything your coach should know?"}
                className="mt-2 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60"
              />
            )}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-bold">2. Pick what you&apos;ll do instead</h3>
            <label className="mb-2 flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3">
              <Search size={16} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all exercises" className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-muted/60" />
            </label>
            {!q && <p className="mb-2 text-xs text-muted">Closest matches first. They train the same movement, so you keep the same adaptation.</p>}
            {error && <p className="mb-2 text-sm font-bold text-brand">{error}</p>}
            {!opts ? (
              <p className="py-4 text-center text-sm text-muted">Finding similar exercises…</p>
            ) : list.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Nothing found.</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {list.map((o) => (
                  <li key={o.id}>
                    <button type="button" disabled={pending} onClick={() => pick(o)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 disabled:opacity-60">
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{o.name}</span>
                        {o.sub && <span className="block text-xs text-muted">{o.sub}</span>}
                      </span>
                      {o.hasVideo && <PlayCircle size={18} className="shrink-0 text-muted" aria-label="Has video" />}
                      <span className="shrink-0 text-sm font-extrabold text-brand">Use</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
