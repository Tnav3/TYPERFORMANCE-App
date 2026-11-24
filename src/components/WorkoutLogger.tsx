"use client";
// TrainHeroic-style logging: tap a set to complete it (saves instantly),
// rest timer starts automatically, progress bar for the session.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Timer, X } from "lucide-react";
import Link from "next/link";
import { ExerciseVideo } from "@/components/ExerciseVideo";
import {
  finishWorkout,
  logSet,
  reopenWorkout,
  saveItemLog,
  saveWorkoutComment,
} from "@/app/train/actions";

export interface LoggerSet {
  setNo: number;
  reps: string;
  kg: string;
  value: string;
  done: boolean;
}

export interface LoggerItem {
  id: string;
  kind: "exercise" | "text";
  label: string;
  name: string;
  exerciseId: string | null;
  rx: string;
  meta: string;
  notes: string | null;
  cues: string | null;
  videoUrl: string | null;
  loadChip: string | null;
  warn: string | null;
  prev: string | null;
  measure: "load" | "bodyweight" | "time" | "distance" | "calories";
  restSec: number | null;
  sets: LoggerSet[];
  comment: string;
  done: boolean;
}

export interface LoggerBlock {
  letter: string;
  superset: boolean;
  items: LoggerItem[];
}

const UNIT = { time: "sec", distance: "m", calories: "cal" } as const;
const RPE = [
  [10, "Max effort"],
  [9, "Really hard"],
  [8, "Hard"],
  [7, "Challenging"],
  [6, "Moderate+"],
  [5, "Moderate"],
  [4, "Somewhat easy"],
  [3, "Easy"],
  [2, "Very easy"],
  [1, "Rest"],
] as const;

type SaveState = "idle" | "saving" | "error";

export function WorkoutLogger({
  workoutId,
  blocks: initial,
  comment: initialComment,
  finished,
  rpe,
  duration,
  readOnly,
}: {
  workoutId: string;
  blocks: LoggerBlock[];
  comment: string;
  finished: boolean;
  rpe: number | null;
  duration: number | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(initial);
  const [status, setStatus] = useState<Record<string, SaveState>>({});
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [comment, setComment] = useState(initialComment);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishErr, setFinishErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const startedAt = useRef(Date.now());

  // Rest timer tick
  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest]);
  const restLeft = rest ? Math.max(0, Math.ceil((rest.until - now) / 1000)) : 0;
  useEffect(() => {
    if (rest && restLeft === 0) {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
      const t = setTimeout(() => setRest(null), 1500);
      return () => clearTimeout(t);
    }
  }, [rest, restLeft]);

  const { total, done } = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const b of blocks)
      for (const i of b.items) {
        if (i.kind === "text") {
          total++;
          if (i.done) done++;
        } else {
          total += i.sets.length;
          done += i.sets.filter((s) => s.done).length;
        }
      }
    return { total, done };
  }, [blocks]);

  const update = (itemId: string, fn: (i: LoggerItem) => LoggerItem) =>
    setBlocks((bs) => bs.map((b) => ({ ...b, items: b.items.map((i) => (i.id === itemId ? fn(i) : i)) })));

  async function saveSet(item: LoggerItem, s: LoggerSet) {
    const key = `${item.id}:${s.setNo}`;
    setStatus((st) => ({ ...st, [key]: "saving" }));
    const timed = item.measure === "time" || item.measure === "distance" || item.measure === "calories";
    const r = await logSet({
      workoutId,
      itemId: item.id,
      setNo: s.setNo,
      done: s.done,
      reps: timed ? null : s.reps,
      kg: timed ? null : s.kg,
      value: timed ? s.value : null,
    });
    setStatus((st) => ({ ...st, [key]: r.ok ? "idle" : "error" }));
  }

  function toggleSet(item: LoggerItem, setNo: number) {
    if (readOnly) return;
    const cur = blocks.flatMap((b) => b.items).find((i) => i.id === item.id);
    const s = cur?.sets.find((x) => x.setNo === setNo);
    if (!cur || !s) return;
    const changed = { ...s, done: !s.done };
    update(item.id, (i) => ({ ...i, sets: i.sets.map((x) => (x.setNo === setNo ? changed : x)) }));
    saveSet(cur, changed);
    if (changed.done && cur.restSec) setRest({ until: Date.now() + cur.restSec * 1000, total: cur.restSec });
  }

  function editSet(item: LoggerItem, setNo: number, field: "reps" | "kg" | "value", v: string) {
    update(item.id, (i) => ({
      ...i,
      sets: i.sets.map((s) => (s.setNo === setNo ? { ...s, [field]: v } : s)),
    }));
  }

  function commitSet(item: LoggerItem, setNo: number) {
    const cur = blocks.flatMap((b) => b.items).find((i) => i.id === item.id)?.sets.find((s) => s.setNo === setNo);
    if (cur?.done) saveSet(item, cur); // edits to a completed set save on leaving the box
  }

  function addSet(item: LoggerItem) {
    update(item.id, (i) => {
      const last = i.sets[i.sets.length - 1];
      return {
        ...i,
        sets: [
          ...i.sets,
          { setNo: (last?.setNo ?? 0) + 1, reps: last?.reps ?? "", kg: last?.kg ?? "", value: last?.value ?? "", done: false },
        ],
      };
    });
  }

  function toggleBlockDone(item: LoggerItem) {
    if (readOnly) return;
    const next = !item.done;
    update(item.id, (i) => ({ ...i, done: next }));
    saveItemLog({ workoutId, itemId: item.id, done: next });
  }

  function finish(fd: FormData) {
    setFinishErr(null);
    start(async () => {
      const r = await finishWorkout({
        workoutId,
        rpe: Number(fd.get("rpe")),
        duration: Number(fd.get("duration")),
        comment,
      });
      if (!r.ok) setFinishErr(r.error);
      else {
        setFinishOpen(false);
        router.refresh();
      }
    });
  }

  const pct = total ? Math.round((done / total) * 100) : 0;
  const elapsedMin = Math.max(5, Math.round((Date.now() - startedAt.current) / 60000));
  const cell =
    "h-11 w-full min-w-0 rounded-lg border border-line bg-surface-2 px-1 text-center text-base text-text focus:border-brand focus:outline-none disabled:opacity-60";

  return (
    <div className="pb-28">
      {/* Progress */}
      <div className="sticky top-0 z-10 -mx-5 mb-4 bg-ink/95 px-5 py-2 backdrop-blur">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted">
          <span>{finished ? "Completed" : "Progress"}</span>
          <span>
            {done}/{total}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="space-y-4">
        {blocks.map((b) => (
          <section key={b.letter} className={`rounded-2xl border bg-surface p-3 ${b.superset ? "border-brand/40" : "border-line"}`}>
            {b.superset && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">
                Superset {b.letter}: alternate between these
              </p>
            )}
            <div className="space-y-5">
              {b.items.map((it) =>
                it.kind === "text" ? (
                  <div key={it.id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-black uppercase tracking-tight">
                        <span className="mr-2 text-brand">{it.label}</span>
                        {it.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleBlockDone(it)}
                        disabled={readOnly}
                        aria-pressed={it.done}
                        aria-label={it.done ? "Mark not done" : "Mark done"}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition ${it.done ? "border-ok bg-ok text-white" : "border-line text-muted"}`}
                      >
                        <Check size={22} strokeWidth={3} />
                      </button>
                    </div>
                    {it.notes && <p className="mt-1 whitespace-pre-line text-sm text-muted">{it.notes}</p>}
                    <ItemNote workoutId={workoutId} item={it} readOnly={readOnly} />
                  </div>
                ) : (
                  <div key={it.id}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black uppercase tracking-tight">
                        <span className="mr-2 text-brand">{it.label}</span>
                        {it.exerciseId ? (
                          <Link href={`/train/history/${it.exerciseId}`} className="hover:underline">
                            {it.name}
                          </Link>
                        ) : (
                          it.name
                        )}
                      </p>
                      {it.loadChip && (
                        <span className="shrink-0 rounded-full bg-brand/15 px-2.5 py-1 text-sm font-black text-brand">
                          {it.loadChip}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted">
                      {it.rx}
                      {it.meta && ` · ${it.meta}`}
                    </p>
                    {it.warn && <p className="text-xs text-warn">{it.warn}</p>}
                    {it.notes && <p className="mt-1 text-sm">{it.notes}</p>}
                    {it.cues && (
                      <details className="mt-1 text-sm">
                        <summary className="cursor-pointer text-muted">Coaching cues</summary>
                        <p className="mt-1 whitespace-pre-line">{it.cues}</p>
                      </details>
                    )}
                    <ExerciseVideo url={it.videoUrl} name={it.name} />
                    {it.prev && <p className="text-xs text-muted">Last time: {it.prev}</p>}

                    <div className="mt-2 space-y-1.5">
                      {it.sets.map((s) => {
                        const key = `${it.id}:${s.setNo}`;
                        const st = status[key];
                        const timed = it.measure === "time" || it.measure === "distance" || it.measure === "calories";
                        return (
                          <div
                            key={s.setNo}
                            className={`grid grid-cols-[1.75rem_1fr_1fr_3rem] items-center gap-2 rounded-xl p-1 transition ${s.done ? "bg-ok/10" : ""}`}
                          >
                            <span className="text-center text-sm font-bold text-muted">{s.setNo}</span>
                            {timed ? (
                              <label className="col-span-2 flex items-center gap-2">
                                <input
                                  value={s.value}
                                  onChange={(e) => editSet(it, s.setNo, "value", e.target.value)}
                                  onBlur={() => commitSet(it, s.setNo)}
                                  inputMode="decimal"
                                  disabled={readOnly}
                                  className={cell}
                                  aria-label={`Set ${s.setNo} ${UNIT[it.measure as keyof typeof UNIT]}`}
                                />
                                <span className="w-8 text-xs text-muted">{UNIT[it.measure as keyof typeof UNIT]}</span>
                              </label>
                            ) : (
                              <>
                                <label className="flex items-center gap-1">
                                  <input
                                    value={s.reps}
                                    onChange={(e) => editSet(it, s.setNo, "reps", e.target.value)}
                                    onBlur={() => commitSet(it, s.setNo)}
                                    inputMode="numeric"
                                    disabled={readOnly}
                                    className={cell}
                                    aria-label={`Set ${s.setNo} reps`}
                                  />
                                  <span className="w-7 text-xs text-muted">reps</span>
                                </label>
                                <label className="flex items-center gap-1">
                                  <input
                                    value={s.kg}
                                    onChange={(e) => editSet(it, s.setNo, "kg", e.target.value)}
                                    onBlur={() => commitSet(it, s.setNo)}
                                    inputMode="decimal"
                                    disabled={readOnly}
                                    className={cell}
                                    aria-label={`Set ${s.setNo} kg`}
                                  />
                                  <span className="w-7 text-xs text-muted">{it.measure === "bodyweight" ? "+kg" : "kg"}</span>
                                </label>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => (st === "error" ? saveSet(it, s) : toggleSet(it, s.setNo))}
                              disabled={readOnly}
                              aria-pressed={s.done}
                              aria-label={st === "error" ? "Retry saving" : s.done ? `Undo set ${s.setNo}` : `Complete set ${s.setNo}`}
                              className={`flex h-11 w-12 items-center justify-center rounded-xl border-2 transition ${
                                st === "error"
                                  ? "border-brand bg-brand/15 text-brand"
                                  : s.done
                                    ? "border-ok bg-ok text-white"
                                    : "border-line text-muted active:scale-95"
                              } ${st === "saving" ? "opacity-70" : ""}`}
                            >
                              {st === "error" ? <RotateCcw size={20} /> : <Check size={22} strokeWidth={3} />}
                            </button>
                          </div>
                        );
                      })}
                      {Object.entries(status).some(([k, v]) => k.startsWith(it.id) && v === "error") && (
                        <p className="text-xs text-brand">Not saved (no connection?). Tap the red button to retry.</p>
                      )}
                      {!readOnly && (
                        <button type="button" onClick={() => addSet(it)} className="min-h-11 text-sm font-bold text-muted">
                          + Add set
                        </button>
                      )}
                    </div>
                    <ItemNote workoutId={workoutId} item={it} readOnly={readOnly} />
                  </div>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-semibold">How did it go? (your coach sees this)</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => !readOnly && saveWorkoutComment({ workoutId, comment })}
          rows={3}
          maxLength={1000}
          disabled={readOnly}
          className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-text focus:border-brand focus:outline-none"
        />
      </label>

      {!readOnly && (
        <div className="mt-4">
          {finished ? (
            <div className="flex items-center justify-between rounded-2xl border border-ok/50 bg-ok/10 p-4">
              <span className="font-bold">
                Done · RPE {rpe} · {duration} min
              </span>
              <span className="flex gap-3 text-sm">
                <button type="button" onClick={() => setFinishOpen(true)} className="underline underline-offset-4">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => start(async () => { await reopenWorkout({ workoutId }); router.refresh(); })}
                  className="text-muted underline underline-offset-4"
                >
                  Reopen
                </button>
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFinishOpen(true)}
              className="min-h-14 w-full rounded-2xl bg-brand text-lg font-black uppercase tracking-wide text-white"
            >
              Finish workout
            </button>
          )}
        </div>
      )}

      {/* Finish sheet */}
      {finishOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Finish workout">
          <form action={finish} className="w-full max-w-md rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-black uppercase">Finish workout</p>
              <button type="button" onClick={() => setFinishOpen(false)} aria-label="Close" className="flex h-11 w-11 items-center justify-center text-muted">
                <X />
              </button>
            </div>
            <p className="mb-2 text-sm text-muted">How hard was the whole session?</p>
            <div className="mb-4 grid grid-cols-5 gap-1.5">
              {RPE.map(([v, l]) => (
                <label key={v} className="cursor-pointer">
                  <input type="radio" name="rpe" value={v} defaultChecked={rpe === v} className="peer sr-only" required />
                  <span className="flex min-h-12 flex-col items-center justify-center rounded-xl border border-line text-center peer-checked:border-brand peer-checked:bg-brand/20">
                    <span className="text-lg font-black">{v}</span>
                    <span className="px-0.5 text-[10px] leading-tight text-muted">{l}</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="mb-4 block text-sm">
              <span className="mb-1 block text-muted">Minutes</span>
              <input
                name="duration"
                type="number"
                inputMode="numeric"
                min={5}
                max={360}
                required
                defaultValue={duration ?? elapsedMin}
                className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-text focus:border-brand focus:outline-none"
              />
            </label>
            {finishErr && <p className="mb-2 text-sm text-brand">{finishErr}</p>}
            <button disabled={pending} className="min-h-14 w-full rounded-2xl bg-brand text-lg font-black uppercase text-white disabled:opacity-60">
              {pending ? "Saving…" : "Save workout"}
            </button>
          </form>
        </div>
      )}

      {/* Rest timer */}
      {rest && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 shadow-2xl">
            <Timer className="text-brand" />
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-muted">{restLeft === 0 ? "Go!" : "Rest"}</p>
              <p className="text-2xl font-black tabular-nums">
                {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, "0")}
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-brand" style={{ width: `${(restLeft / rest.total) * 100}%` }} />
              </div>
            </div>
            <button type="button" onClick={() => setRest((r) => r && { ...r, until: r.until + 15000, total: r.total + 15 })} className="min-h-11 rounded-xl border border-line px-3 text-sm font-bold">
              +15s
            </button>
            <button type="button" onClick={() => setRest(null)} className="min-h-11 rounded-xl border border-line px-3 text-sm font-bold">
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemNote({ workoutId, item, readOnly }: { workoutId: string; item: LoggerItem; readOnly: boolean }) {
  const [v, setV] = useState(item.comment);
  const [saved, setSaved] = useState(item.comment);
  return (
    <details className="mt-2" open={!!item.comment}>
      <summary className="cursor-pointer text-sm text-muted">{item.comment ? "Your note" : "+ Add a note for your coach"}</summary>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={async () => {
          if (readOnly || v === saved) return;
          const r = await saveItemLog({ workoutId, itemId: item.id, comment: v });
          if (r.ok) setSaved(v);
        }}
        rows={2}
        maxLength={500}
        disabled={readOnly}
        className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-text focus:border-brand focus:outline-none"
        aria-label="Note for your coach"
      />
    </details>
  );
}
