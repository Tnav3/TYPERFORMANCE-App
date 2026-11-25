"use client";
import { MyExerciseNote } from "./MyExerciseNote";
import { BAND_LEVELS } from "@/lib/programming/fields";
// TrainHeroic-style logging: tap a set to complete it (saves instantly),
// rest timer starts automatically, progress bar for the session.
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, List, RotateCcw, Timer, X } from "lucide-react";
import { ExerciseSheet } from "@/components/ExerciseSheet";
import { SwapSheet } from "@/components/SwapSheet";
import { IntensityDial } from "@/components/IntensityDial";
import { swapExercise } from "@/app/train/actions";
import { SWAP_REASONS } from "@/lib/programming/types";
import { ArrowLeftRight, Info, PlayCircle } from "lucide-react";
import {
  finishWorkout,
  logSet,
  reopenWorkout,
  saveItemLog,
  saveWorkoutComment,
} from "@/app/train/actions";

export interface LoggerSet {
  setNo: number;
  done: boolean;
  /** What the client typed, by field (display units) */
  v: Record<string, string>;
  /** Prescribed / suggested values, shown faded; used when a box is left empty */
  hint: Record<string, string>;
}

export interface LoggerField {
  key: string;
  unit: string;
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
  /** The client's own setup note for this exercise. */
  myNote: string | null;
  videoUrl: string | null;
  loadChip: string | null;
  warn: string | null;
  prev: string | null;
  fields: LoggerField[];
  restSec: number | null;
  sets: LoggerSet[];
  comment: string;
  done: boolean;
  /** Set when the client swapped the programmed exercise. */
  swap: { fromName: string; reason: string | null; note: string | null } | null;
  plannedId: string | null;
  category: string | null;
}

export interface LoggerBlock {
  letter: string;
  title: string | null;
  superset: boolean;
  items: LoggerItem[];
}


type SaveState = "idle" | "saving" | "error";

export function WorkoutLogger({
  workoutId,
  blocks: initial,
  comment: initialComment,
  finished,
  rpe,
  duration,
  readOnly,
  lastRpe,
  athleteId,
  embedded = false,
}: {
  workoutId: string;
  blocks: LoggerBlock[];
  comment: string;
  finished: boolean;
  rpe: number | null;
  duration: number | null;
  readOnly: boolean;
  /** Previous finished session's rating, to compare against */
  lastRpe?: { rpe: number; date: string } | null;
  /** Coach logging for this client (Train together) */
  athleteId?: string;
  /** Inside a panel: no sticky/fixed bars, always the full list */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(initial);
  const [status, setStatus] = useState<Record<string, SaveState>>({});
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [sheet, setSheet] = useState<{ id: string; name: string } | null>(null);
  const [view, setView] = useState<"focus" | "list">(finished || readOnly || embedded ? "list" : "focus");
  const [idx, setIdx] = useState(0); // current block; blocks.length = wrap-up screen
  const [timersOpen, setTimersOpen] = useState(false);
  const [clock, setClock] = useState<{ kind: "stopwatch" | "interval"; start: number; work?: number; off?: number; rounds?: number; label: string } | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const [swapFor, setSwapFor] = useState<LoggerItem | null>(null);
  const closeSwap = useCallback(() => setSwapFor(null), []);
  // A swap (or undo) reloads the workout from the server
  useEffect(() => setBlocks(initial), [initial]);
  const [now, setNow] = useState(() => Date.now());
  const [comment, setComment] = useState(initialComment);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishErr, setFinishErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const startedAt = useRef(Date.now());

  // Rest timer tick
  useEffect(() => {
    if (!rest && !clock) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest, clock]);
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

  const totals = useMemo(() => {
    let reps = 0;
    let vol = 0;
    let unit = "kg";
    for (const b of blocks)
      for (const i of b.items)
        for (const x of i.sets) {
          if (!x.done) continue;
          const r = Number((x.v.reps ?? "").trim() || x.hint.reps || 0);
          const w = Number((x.v.weight ?? "").trim() || x.hint.weight || 0);
          if (Number.isFinite(r)) reps += r;
          if (Number.isFinite(r) && Number.isFinite(w)) vol += r * w;
          const wf = i.fields.find((f) => f.key === "weight");
          if (wf) unit = wf.unit.replace("+", "");
        }
    return { reps, vol: Math.round(vol), unit };
  }, [blocks]);
  const blockDone = (b: LoggerBlock) => b.items.every((i) => (i.kind === "text" ? i.done : i.sets.length > 0 && i.sets.every((x) => x.done)));
  const go = (n: number) => {
    setIdx(Math.max(0, Math.min(blocks.length, n)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const update = (itemId: string, fn: (i: LoggerItem) => LoggerItem) =>
    setBlocks((bs) => bs.map((b) => ({ ...b, items: b.items.map((i) => (i.id === itemId ? fn(i) : i)) })));

  async function saveSet(item: LoggerItem, s: LoggerSet) {
    const key = `${item.id}:${s.setNo}`;
    setStatus((st) => ({ ...st, [key]: "saving" }));
    const values = Object.fromEntries(item.fields.map((f) => [f.key, (s.v[f.key] ?? "").trim() || (s.hint[f.key] ?? "")]));
    const r = await logSet({ workoutId, athleteId, itemId: item.id, setNo: s.setNo, done: s.done, values });
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

  /** One tap: tick every open set using what's typed, else the greyed-out target / last-session numbers. */
  function logAll(item: LoggerItem) {
    if (readOnly) return;
    const cur = blocks.flatMap((b) => b.items).find((i) => i.id === item.id);
    if (!cur) return;
    const open = cur.sets.filter((x) => !x.done);
    update(item.id, (i) => ({ ...i, sets: i.sets.map((x) => (x.done ? x : { ...x, done: true })) }));
    open.forEach((x) => saveSet(cur, { ...x, done: true }));
  }

  function editSet(item: LoggerItem, setNo: number, field: string, val: string) {
    update(item.id, (i) => ({
      ...i,
      sets: i.sets.map((x) => (x.setNo === setNo ? { ...x, v: { ...x.v, [field]: val } } : x)),
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
        sets: [...i.sets, { setNo: (last?.setNo ?? 0) + 1, done: false, v: { ...(last?.v ?? {}) }, hint: { ...(last?.hint ?? {}) } }],
      };
    });
  }

  function toggleBlockDone(item: LoggerItem) {
    if (readOnly) return;
    const next = !item.done;
    update(item.id, (i) => ({ ...i, done: next }));
    saveItemLog({ workoutId, athleteId, itemId: item.id, done: next });
  }

  function finish(fd: FormData) {
    setFinishErr(null);
    if (!Number(fd.get("rpe"))) {
      setFinishErr("Slide to rate how hard the session was.");
      return;
    }
    start(async () => {
      const r = await finishWorkout({
        workoutId,
        athleteId,
        rpe: Number(fd.get("rpe")),
        duration: Number(fd.get("duration")),
        comment,
      });
      if (!r.ok) setFinishErr(r.error);
      else {
        setFinishOpen(false);
        if (embedded) router.refresh();
        else router.push(`/train/${workoutId}/summary`);
      }
    });
  }

  const elapsedMin = Math.max(5, Math.round((Date.now() - startedAt.current) / 60000));
  const cell =
    "h-11 w-full min-w-0 rounded-lg border border-line bg-surface-2 px-1 text-center text-base text-text focus:border-brand focus:outline-none disabled:opacity-60";

  return (
    <div className={embedded ? "" : "pb-44"}>
      {/* Progress: one dot per block, running totals */}
      {!embedded && <div className="sticky top-0 z-10 -mx-5 mb-4 border-b border-line bg-ink/95 px-5 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {blocks.map((b, k) => (
              <button
                key={b.letter}
                type="button"
                onClick={() => {
                  setView("focus");
                  go(k);
                }}
                aria-label={`Go to ${b.letter}`}
                className={`h-2.5 rounded-full transition-all ${
                  view === "focus" && k === idx ? "w-6 bg-brand" : blockDone(b) ? "w-2.5 bg-ok" : "w-2.5 bg-line"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setView(view === "focus" ? "list" : "focus")}
            className="flex min-h-9 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-bold text-muted"
          >
            <List size={14} /> {view === "focus" ? "See all" : "One at a time"}
          </button>
        </div>
        <p className="mt-1.5 flex gap-4 text-sm">
          <span><b className="font-black">{totals.reps}</b> <span className="text-muted">reps</span></span>
          {totals.vol > 0 && <span><b className="font-black">{totals.vol.toLocaleString()}</b> <span className="text-muted">{totals.unit} lifted</span></span>}
          <span className="ml-auto text-muted">{done}/{total} {finished ? "· done" : "sets"}</span>
        </p>
      </div>}

      <div className="space-y-4">
        {blocks.map((b, bi) => (view === "focus" && bi !== idx ? null :
          <section key={b.letter} className={`rounded-2xl border bg-surface p-3 ${b.superset ? "border-brand/40" : "border-line"}`}>
            {(b.superset || b.title) && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">
                {b.title ? `${b.letter}: ${b.title}` : `Superset ${b.letter}`}
                {b.superset && b.title && " · superset"}
                {b.superset && <span className="ml-1 font-normal normal-case tracking-normal text-muted">alternate between these</span>}
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
                    <ItemNote workoutId={workoutId} athleteId={athleteId} item={it} readOnly={readOnly} />
                  </div>
                ) : (
                  <div key={it.id}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black uppercase tracking-tight">
                        <span className="mr-2 text-brand">{it.label}</span>
                        {it.exerciseId ? (
                          <button
                            type="button"
                            onClick={() => setSheet({ id: it.exerciseId!, name: it.name })}
                            className="text-left uppercase underline decoration-line decoration-2 underline-offset-4 hover:decoration-brand"
                          >
                            {it.name}
                          </button>
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
                    {it.exerciseId && <MyExerciseNote exerciseId={it.exerciseId} initial={it.myNote} readOnly={readOnly} />}
                    {it.exerciseId && (
                      <button
                        type="button"
                        onClick={() => setSheet({ id: it.exerciseId!, name: it.name })}
                        className="mt-1 inline-flex min-h-9 items-center gap-1.5 text-sm font-bold text-brand"
                      >
                        {it.videoUrl ? <PlayCircle size={16} /> : <Info size={16} />}
                        {it.videoUrl ? "Demo, how-to & my history" : "How-to & my history"}
                      </button>
                    )}
                    {it.swap ? (
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span className="rounded-md bg-warn/15 px-1.5 py-0.5 font-bold text-warn">Swapped</span>
                        <span>
                          for {it.swap.fromName}
                          {it.swap.reason && ` · ${SWAP_REASONS.find((r) => r[0] === it.swap!.reason)?.[1] ?? ""}`}
                          {it.swap.note && ` · “${it.swap.note}”`}
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => start(async () => { const r = await swapExercise({ workoutId, athleteId, itemId: it.id, exerciseId: null }); if (r.ok) router.refresh(); })}
                            className="min-h-9 font-bold text-brand underline underline-offset-4"
                          >
                            Undo
                          </button>
                        )}
                      </p>
                    ) : (
                      it.exerciseId && !readOnly && (
                        <button type="button" onClick={() => setSwapFor(it)} className="ml-3 mt-1 inline-flex min-h-9 items-center gap-1.5 text-sm font-bold text-muted hover:text-text">
                          <ArrowLeftRight size={15} /> Swap
                        </button>
                      )
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {it.prev && (
                        <p className="inline-flex rounded-lg bg-surface-2 px-2.5 py-1 text-xs">
                          <span className="mr-1.5 font-bold uppercase tracking-wide text-muted">Last</span> {it.prev}
                        </p>
                      )}
                      {!readOnly && it.sets.some((x) => !x.done) && it.sets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => logAll(it)}
                          className="inline-flex min-h-8 items-center rounded-lg border border-line px-2.5 text-xs font-bold text-muted hover:text-text"
                          title="Tick every set with the numbers shown"
                        >
                          ✓ Log all as shown
                        </button>
                      )}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      <div
                        className={`grid items-end gap-2 px-1 text-[11px] uppercase tracking-wide text-muted ${it.fields.length > 4 ? "hidden" : ""}`}
                        style={{ gridTemplateColumns: `1.75rem repeat(${it.fields.length}, minmax(0, 1fr)) 3rem` }}
                      >
                        <span className="text-center">Set</span>
                        {it.fields.map((f) => (
                          <span key={f.key} className="text-center">{f.unit}</span>
                        ))}
                        <span />
                      </div>
                      {it.sets.map((s) => {
                        const key = `${it.id}:${s.setNo}`;
                        const st = status[key];
                        return (
                          <div
                            key={s.setNo}
                            className={`grid items-center gap-2 rounded-xl p-1 transition ${s.done ? "bg-ok/10" : ""}`}
                            style={{ gridTemplateColumns: it.fields.length > 4 ? "1.75rem minmax(0, 1fr) 3rem" : `1.75rem repeat(${it.fields.length}, minmax(0, 1fr)) 3rem` }}
                          >
                            <span className="text-center text-sm font-bold text-muted">{s.setNo}</span>
                            <Wrap on={it.fields.length > 4}>
                            {it.fields.map((f) => (
                              <Cell key={f.key} label={it.fields.length > 4 ? f.unit : null}>
                              {
                              f.key === "time" && !readOnly ? (
                                <div key={f.key} className="flex min-w-0 items-center gap-1">
                                  <Stopwatch onStop={(sec) => editSet(it, s.setNo, "time", String(sec))} />
                                  <input
                                    value={s.v.time ?? ""}
                                    placeholder={s.hint.time ?? ""}
                                    onChange={(e) => editSet(it, s.setNo, "time", e.target.value)}
                                    onBlur={() => commitSet(it, s.setNo)}
                                    inputMode="decimal"
                                    className={`${cell} placeholder:text-muted/50`}
                                    aria-label={`Set ${s.setNo} seconds`}
                                  />
                                </div>
                              ) : f.key === "band" ? (
                                <select
                                  key={f.key}
                                  value={s.v.band || s.hint.band || ""}
                                  disabled={readOnly}
                                  onChange={(e) => {
                                    editSet(it, s.setNo, "band", e.target.value);
                                    if (s.done) saveSet(it, { ...s, v: { ...s.v, band: e.target.value } });
                                  }}
                                  className={`${cell} !px-1`}
                                  aria-label={`Set ${s.setNo} band tension`}
                                >
                                  <option value="">Band</option>
                                  {BAND_LEVELS.map(([v, l]) => <option key={v} value={String(v)}>{l}</option>)}
                                </select>
                              ) : (
                                <input
                                  key={f.key}
                                  value={s.v[f.key] ?? ""}
                                  placeholder={s.hint[f.key] ?? ""}
                                  onChange={(e) => editSet(it, s.setNo, f.key, e.target.value)}
                                  onBlur={() => commitSet(it, s.setNo)}
                                  inputMode={f.key === "reps" || f.key === "heart_rate" || f.key === "watts" || f.key === "calories" ? "numeric" : "decimal"}
                                  disabled={readOnly}
                                  className={`${cell} placeholder:text-muted/50`}
                                  aria-label={`Set ${s.setNo} ${f.unit}`}
                                />
                              )}
                              </Cell>
                            ))}
                            </Wrap>
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
                    <ItemNote workoutId={workoutId} athleteId={athleteId} item={it} readOnly={readOnly} />
                  </div>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      {(view === "list" || idx >= blocks.length) && (<>
      {view === "focus" && (
        <div className="mb-2">
          <p className="text-2xl font-black uppercase tracking-tight">{done === total ? "Nice work." : "Almost there"}</p>
          <p className="text-muted">
            {done}/{total} sets ticked{done < total ? ". You can go back and finish them, or save as is." : "."}
          </p>
        </div>
      )}
      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-semibold">How did it go? (your coach sees this)</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => !readOnly && saveWorkoutComment({ workoutId, athleteId, comment })}
          rows={3}
          maxLength={1000}
          disabled={readOnly}
          className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-text focus:border-brand focus:outline-none"
        />
      </label>

      {!readOnly && (
        <div className="mt-4">
          {finished && !finishOpen ? (
            <div className="flex items-center justify-between rounded-2xl border border-ok/50 bg-ok/10 p-4">
              <span className="font-bold">
                Done · intensity {rpe}/10 · {duration} min
              </span>
              <span className="flex gap-3 text-sm">
                <button type="button" onClick={() => setFinishOpen(true)} className="min-h-9 underline underline-offset-4">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => start(async () => { await reopenWorkout({ workoutId, athleteId }); router.refresh(); })}
                  className="min-h-9 text-muted underline underline-offset-4"
                >
                  Reopen
                </button>
              </span>
            </div>
          ) : (
            <form action={finish} className="space-y-4 rounded-2xl border border-line bg-surface p-4">
              <IntensityDial name="rpe" initial={rpe} last={lastRpe ?? null} />
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold">Minutes</span>
                <input
                  name="duration"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={360}
                  required
                  defaultValue={duration ?? elapsedMin}
                  className="min-h-12 w-28 rounded-xl border border-line bg-surface-2 px-3 text-center text-text focus:border-brand focus:outline-none"
                />
              </label>
              {finishErr && <p className="text-sm font-bold text-brand">{finishErr}</p>}
              <button disabled={pending} className="min-h-14 w-full rounded-2xl bg-brand text-lg font-black uppercase tracking-wide text-white disabled:opacity-60">
                {pending ? "Saving…" : finished ? "Save changes" : "Finish workout"}
              </button>
            </form>
          )}
        </div>
      )}
      {readOnly && (
        <div className="mt-4 space-y-2 rounded-2xl border border-dashed border-line bg-surface p-4">
          <IntensityDial name="rpe_preview" initial={rpe} last={null} disabled />
          <p className="text-xs text-muted">{finished ? "What they rated this session." : "Clients rate the session here before tapping Finish workout. It's required."}</p>
        </div>
      )}

      </>)}

      {/* Bottom bar: Back · Timers · Next */}
      {view === "focus" && !embedded && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-[1fr_auto_1fr] items-center gap-2">
            <button type="button" onClick={() => go(idx - 1)} disabled={idx === 0} className="flex min-h-12 items-center gap-1 rounded-xl px-2 font-bold text-muted disabled:opacity-30">
              <ChevronLeft size={20} /> Back
            </button>
            <button
              type="button"
              onClick={() => setTimersOpen(true)}
              disabled={readOnly}
              className="flex h-12 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-4 text-sm font-bold disabled:opacity-40"
            >
              <Timer size={18} className="text-brand" /> Timer
            </button>
            {idx < blocks.length ? (
              <button type="button" onClick={() => go(idx + 1)} className="flex min-h-12 items-center justify-end gap-1 rounded-xl px-2 font-black text-brand">
                {idx === blocks.length - 1 ? "Wrap up" : "Next"} <ChevronRight size={20} />
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>
      )}

      {/* Timers sheet */}
      {timersOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Timers">
          <div className="w-full max-w-md rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-black uppercase">Timers</p>
              <button type="button" onClick={() => setTimersOpen(false)} aria-label="Close" className="flex h-11 w-11 items-center justify-center text-muted">
                <X />
              </button>
            </div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted">Rest</p>
            <div className="mb-4 grid grid-cols-4 gap-2">
              {[60, 90, 120, 180].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setRest({ until: Date.now() + sec * 1000, total: sec });
                    setTimersOpen(false);
                  }}
                  className="min-h-14 rounded-xl border border-line bg-surface-2 text-lg font-black"
                >
                  {sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : `${sec}s`}
                </button>
              ))}
            </div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted">Other</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Stopwatch", sub: "count up", c: { kind: "stopwatch" as const, label: "Stopwatch" } },
                { label: "EMOM", sub: "every minute ×10", c: { kind: "interval" as const, work: 60, off: 0, rounds: 10, label: "EMOM" } },
                { label: "Tabata", sub: "20s on / 10s off ×8", c: { kind: "interval" as const, work: 20, off: 10, rounds: 8, label: "Tabata" } },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setClock({ ...t.c, start: Date.now() });
                    setNow(Date.now());
                    setTimersOpen(false);
                  }}
                  className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-line bg-surface-2"
                >
                  <span className="font-black">{t.label}</span>
                  <span className="text-[11px] text-muted">{t.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Running stopwatch / interval clock */}
      {clock && !rest && <ClockBar clock={clock} now={now} raised={view === "focus"} onStop={() => setClock(null)} />}

      {/* Rest timer */}
      {rest && !embedded && (
        <div className={`fixed inset-x-0 z-20 flex justify-center px-4 ${view === "focus" ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" : "bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]"}`}>
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
      {swapFor && swapFor.exerciseId && (
        <SwapSheet
          workoutId={workoutId}
          athleteId={athleteId}
          itemId={swapFor.id}
          exerciseId={swapFor.plannedId ?? swapFor.exerciseId}
          name={swapFor.name}
          onClose={closeSwap}
          onDone={() => {
            setSwapFor(null);
            router.refresh();
          }}
        />
      )}
      {sheet && <ExerciseSheet exerciseId={sheet.id} name={sheet.name} athleteId={athleteId} historyHref={`/train/history/${sheet.id}`} onClose={closeSheet} />}
    </div>
  );
}

function ItemNote({ workoutId, athleteId, item, readOnly }: { workoutId: string; athleteId?: string; item: LoggerItem; readOnly: boolean }) {
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
          const r = await saveItemLog({ workoutId, athleteId, itemId: item.id, comment: v });
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

/** Tap to start, tap to stop; fills the set's seconds. */
function Stopwatch({ onStop }: { onStop: (sec: number) => void }) {
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (start == null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [start]);
  const sec = start == null ? 0 : Math.max(0, Math.floor((now - start) / 1000));
  return (
    <button
      type="button"
      onClick={() => {
        if (start == null) {
          const t = Date.now();
          setStart(t);
          setNow(t);
        } else {
          onStop(Math.max(1, Math.round((Date.now() - start) / 1000)));
          setStart(null);
        }
      }}
      className={`flex h-11 min-w-16 shrink-0 items-center justify-center gap-1 rounded-lg border px-2 text-sm font-bold tabular-nums ${start != null ? "border-brand bg-brand text-white" : "border-line text-muted"}`}
      aria-label={start != null ? "Stop stopwatch" : "Start stopwatch"}
    >
      <Timer size={16} />
      {start != null ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "Go"}
    </button>
  );
}

function ClockBar({
  clock,
  now,
  onStop,
  raised,
}: {
  raised: boolean;
  clock: { kind: "stopwatch" | "interval"; start: number; work?: number; off?: number; rounds?: number; label: string };
  now: number;
  onStop: () => void;
}) {
  const el = Math.max(0, Math.floor((now - clock.start) / 1000));
  let big = `${Math.floor(el / 60)}:${String(el % 60).padStart(2, "0")}`;
  let sub = clock.label;
  let phase: "work" | "rest" | "done" = "work";
  if (clock.kind === "interval") {
    const cycle = (clock.work ?? 60) + (clock.off ?? 0);
    const round = Math.floor(el / cycle) + 1;
    if (round > (clock.rounds ?? 1)) phase = "done";
    else {
      const into = el % cycle;
      phase = into < (clock.work ?? 60) ? "work" : "rest";
      const left = phase === "work" ? (clock.work ?? 60) - into : cycle - into;
      big = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      sub = `${clock.label} · round ${round}/${clock.rounds} · ${phase === "work" ? "GO" : "rest"}`;
    }
    if (phase === "done") {
      big = "Done";
      sub = clock.label;
    }
  }
  return (
    <div className={`fixed inset-x-0 z-20 flex justify-center px-4 ${raised ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" : "bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]"}`}>
      <div className={`flex w-full max-w-md items-center gap-3 rounded-2xl border p-3 shadow-2xl ${phase === "rest" ? "border-ok bg-ok/15" : "border-line bg-surface-2"}`}>
        <Timer className="text-brand" />
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-muted">{sub}</p>
          <p className="text-3xl font-black tabular-nums">{big}</p>
        </div>
        <button type="button" onClick={onStop} className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold">
          Stop
        </button>
      </div>
    </div>
  );
}

/** Past 4 things to record, a set's boxes wrap into a small grid, each labelled. */
function Wrap({ on, children }: { on: boolean; children: React.ReactNode }) {
  return on ? <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:grid-cols-4">{children}</div> : <>{children}</>;
}

function Cell({ label, children }: { label: string | null; children: React.ReactNode }) {
  if (!label) return <>{children}</>;
  return (
    <label className="min-w-0 text-[10px] font-bold uppercase tracking-wide text-muted">
      {label}
      {children}
    </label>
  );
}
