"use client";
// Client builds their own workout: pick a day, add exercises, then log it like any other.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import { createOwnWorkout, findExercises, type PickExercise } from "@/app/train/own-actions";

type Line = PickExercise & { sets: string; reps: string };

export function OwnWorkoutBuilder({ days, initialDate }: { days: { iso: string; label: string }[]; initialDate: string }) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [title, setTitle] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<PickExercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => findExercises(q).then((r) => live && setFound(r)), q ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const add = (e: PickExercise) => {
    setLines((l) => (l.some((x) => x.id === e.id) ? l : [...l, { ...e, sets: "3", reps: "10" }]));
    setQ("");
  };
  const move = (i: number, d: number) =>
    setLines((l) => {
      const n = [...l];
      const j = i + d;
      if (j < 0 || j >= n.length) return l;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const save = () => {
    setError(null);
    start(async () => {
      const r = await createOwnWorkout({
        date,
        title,
        items: lines.map((l) => ({ exerciseId: l.id, sets: Number(l.sets) || null, reps: l.reps || null })),
      });
      if (!r.ok) setError(r.error);
      else router.push(`/train/${r.id}`);
    });
  };
  const box = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

  return (
    <div className="space-y-5 pb-28">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Day</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => setDate(d.iso)}
              className={`min-h-11 shrink-0 rounded-xl border px-3 text-sm font-bold ${date === d.iso ? "border-brand bg-brand text-white" : "border-line text-text"}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </section>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">Name (optional)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Hotel gym, Extra conditioning" className={box} />
      </label>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Exercises · {lines.length}</h2>
        {lines.length === 0 && <p className="mb-2 rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">Add exercises below. You&apos;ll enter weights and reps when you log it.</p>}
        <ul className="space-y-2">
          {lines.map((l, i) => (
            <li key={l.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 font-black text-brand">{String.fromCharCode(65 + i)}</span>
                <p className="min-w-0 flex-1 font-bold">{l.name}</p>
                <button type="button" onClick={() => move(i, -1)} className="flex h-9 w-9 items-center justify-center text-muted" aria-label="Move up"><ArrowUp size={16} /></button>
                <button type="button" onClick={() => move(i, 1)} className="flex h-9 w-9 items-center justify-center text-muted" aria-label="Move down"><ArrowDown size={16} /></button>
                <button type="button" onClick={() => setLines((x) => x.filter((y) => y.id !== l.id))} className="flex h-9 w-9 items-center justify-center text-muted" aria-label={`Remove ${l.name}`}><X size={16} /></button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-muted">
                  Sets
                  <input value={l.sets} inputMode="numeric" onChange={(e) => setLines((x) => x.map((y) => (y.id === l.id ? { ...y, sets: e.target.value.replace(/\D/g, "").slice(0, 2) } : y)))} className={`${box} mt-1 text-center`} />
                </label>
                <label className="text-xs text-muted">
                  Reps or time
                  <input value={l.reps} maxLength={20} onChange={(e) => setLines((x) => x.map((y) => (y.id === l.id ? { ...y, reps: e.target.value } : y)))} placeholder="10, 30s, 400m" className={`${box} mt-1 text-center`} />
                </label>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3">
          <Search size={16} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-muted/60" />
        </label>
        {!q && found && found.length > 0 && <p className="mt-2 text-xs text-muted">Ones you&apos;ve done recently:</p>}
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {(found ?? []).map((e) => {
            const on = lines.some((l) => l.id === e.id);
            return (
              <li key={e.id}>
                <button type="button" disabled={on} onClick={() => add(e)} className="flex min-h-12 w-full items-center gap-3 px-3 text-left hover:bg-surface-2 disabled:opacity-50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{e.name}</span>
                    {e.sub && <span className="block text-xs text-muted">{e.sub}</span>}
                  </span>
                  {on ? <span className="text-xs font-bold text-ok">Added</span> : <Plus size={18} className="text-brand" />}
                </button>
              </li>
            );
          })}
          {found && found.length === 0 && <li className="p-3 text-center text-sm text-muted">{q ? "Nothing found." : "Search for an exercise to add."}</li>}
        </ul>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-md">
          {error && <p className="mb-2 text-sm font-bold text-brand">{error}</p>}
          <button type="button" disabled={pending || !lines.length} onClick={save} className="min-h-14 w-full rounded-2xl bg-brand text-lg font-black uppercase tracking-wide text-white disabled:opacity-50">
            {pending ? "Saving…" : `Start logging${lines.length ? ` · ${lines.length}` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
