"use client";
// Spreadsheet-style builder for a day's exercises (program day or dated workout).
// Tick rows → "Superset". Drag the handle to reorder (arrows on phones). Every box saves when you leave it.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, BookmarkPlus, ChevronDown, Copy, GripVertical, Link2, Pencil, Plus, Trash2, Unlink, X } from "lucide-react";
import { formatPrescription, formatRest, formatSetPlan, itemLabel, parsePrescription } from "@/lib/prescription";
import { splitLine } from "@/lib/programming/exercise-search";
import { ExercisePicker } from "./ExercisePicker";
import { EXERCISE_CATEGORIES, type ItemFields } from "@/lib/programming/types";
import { FIELD_KEYS, FIELD_LABEL, MAX_FIELDS, fieldsFor, type FieldKey } from "@/lib/programming/fields";
import {
  builderAdd,
  builderApplyScheme,
  builderApplyWeeks,
  builderDelete,
  builderDuplicate,
  builderOrder,
  builderSetUnits,
  builderUpdate,
  deleteSavedBlock,
  insertBlock,
  listSavedBlocks,
  listSchemes,
  quickAddExercise,
  saveBlock,
  type RowPatch,
} from "@/app/coach/builder-actions";

const box =
  "h-10 w-full min-w-0 rounded-lg border border-line bg-surface-2 px-2 text-sm text-text placeholder:text-muted/50 focus:border-brand focus:outline-none";
const LOADS: [string, string][] = [
  ["none", "—"],
  ["percent", "%1RM"],
  ["rpe", "RPE"],
  ["kg", "kg"],
  ["bodyweight", "BW"],
  ["velocity", "m/s"],
];
const CATS = EXERCISE_CATEGORIES;

function loadValue(i: ItemFields) {
  const v = i.load_type === "percent" ? i.percent : i.load_type === "rpe" ? i.rpe : i.load_type === "kg" ? i.load_kg : i.load_type === "velocity" ? i.velocity : null;
  return v == null ? "" : String(Number(v));
}
function restText(sec: number | null) {
  if (sec == null) return "";
  if (sec < 60) return `${sec}s`;
  return sec % 60 === 0 ? `${sec / 60}m` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

type Order = { id: string; join: boolean }[];

/** Explain how far a scheme reached, and why if it stopped short. */
function schemeNotice(schemeId: string | null, d: { weeks: number; schemeWeeks?: number }) {
  if (!schemeId) return "Scheme removed from this line.";
  const reached = `Scheme applied to ${d.weeks} week${d.weeks === 1 ? "" : "s"}.`;
  if (d.schemeWeeks && d.schemeWeeks > d.weeks)
    return `${reached} It has ${d.schemeWeeks} weeks: the later weeks don't have this exercise on this day yet. Copy this week forward (or add it to those days), then apply again.`;
  return reached;
}
type LibEx = { id: string; name: string; active: boolean; category?: string | null; measure?: string; fields?: string[] | null; distance_unit?: string; speed_unit?: string };
const orderOf = (list: ItemFields[]): Order => list.map((i, k) => ({ id: i.id, join: k > 0 && i.block === list[k - 1].block }));

/** Move row `from` so it ends up at index `to` (index in the list after removal). */
function moveRow(order: Order, from: number, to: number): Order {
  const o = order.map((x) => ({ ...x }));
  const [row] = o.splice(from, 1);
  // If the moved row led a group, the next row now leads it
  if (!row.join && o[from]?.join) o[from].join = false;
  // Dropping between two rows of a superset joins that superset
  row.join = to > 0 && !!o[to]?.join;
  o.splice(to, 0, row);
  if (to === 0) o[0].join = false;
  return o;
}

export function ItemsEditor({
  table,
  parentId,
  back,
  items: initial,
  exercises,
}: {
  table: "program_items" | "workout_items";
  parentId: string;
  back: string;
  items: ItemFields[];
  exercises: LibEx[];
}) {
  const [items, setItems] = useState(initial);
  const [lib, setLib] = useState(exercises);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; name: string; count: number }[]>([]);
  const [naming, setNaming] = useState<string | null>(null);
  const [schemes, setSchemes] = useState<{ id: string; name: string; weeks: number }[]>([]);
  useEffect(() => {
    listSavedBlocks().then((r) => r.data && setSaved(r.data), () => null);
    listSchemes().then((r) => r.data && setSchemes(r.data), () => null);
  }, []);
  const [missing, setMissing] = useState<{ name: string; then: (name: string) => void } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [busy, start] = useTransition();

  const exName = useMemo(() => new Map(lib.map((e) => [e.id, e.name])), [lib]);
  const known = useMemo(() => new Set(lib.map((e) => e.name.toLowerCase())), [lib]);
  const sizes = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.block, (m.get(i.block) ?? 0) + 1);
    return m;
  }, [items]);

  const run = (fn: () => Promise<{ error?: string; data?: ItemFields[] }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      else if (r.data) setItems(r.data);
    });
  const save = (id: string, patch: RowPatch) => run(() => builderUpdate(table, parentId, id, patch, back));
  const reorder = (o: Order) => {
    // optimistic: show the new order straight away
    const byId = new Map(items.map((i) => [i.id, i]));
    setItems(o.map((x) => byId.get(x.id)!));
    run(() => builderOrder(table, parentId, o, back));
  };

  const withExercise = (name: string, then: (n: string) => void) => {
    if (!name.trim()) return;
    if (known.has(name.trim().toLowerCase())) then(name.trim());
    else setMissing({ name: name.trim(), then });
  };

  // ---- selection actions
  const selected = items.map((i, k) => ({ i, k })).filter((x) => sel.has(x.i.id));
  const blockOf = new Map(items.map((i) => [i.id, i.block]));
  // Rows keep their group only if the row above is still from the same group
  const regroup = (o: { id: string }[]): Order =>
    o.map((x, k) => ({ id: x.id, join: k > 0 && blockOf.get(o[k - 1].id) === blockOf.get(x.id) }));
  const makeSuperset = () => {
    if (selected.length < 2) return;
    const ids = selected.map((x) => x.i.id);
    const firstAt = selected[0].k;
    const restIds = items.filter((i) => !sel.has(i.id));
    const at = restIds.filter((i) => items.indexOf(i) < firstAt).length;
    const rest = regroup(restIds);
    if (rest[at]) rest[at].join = false;
    const group = ids.map((id, n) => ({ id, join: n > 0 }));
    setSel(new Set());
    reorder([...rest.slice(0, at), ...group, ...rest.slice(at)]);
  };
  const split = () => {
    const o = orderOf(items).map((x, k, all) => ({
      ...x,
      join: x.join && !sel.has(x.id) && !sel.has(all[k - 1]?.id ?? ""),
    }));
    setSel(new Set());
    reorder(o);
  };
  const removeSelected = () => {
    const ids = selected.map((x) => x.i.id);
    if (!ids.length) return;
    setSel(new Set());
    run(() => builderDelete(table, parentId, ids, back));
  };

  // ---- drag
  const onDragOver = (e: React.DragEvent, k: number) => {
    if (!dragId) return;
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropAt(e.clientY < r.top + r.height / 2 ? k : k + 1);
  };
  const onDrop = () => {
    if (dragId == null || dropAt == null) return;
    const o = orderOf(items);
    const from = o.findIndex((x) => x.id === dragId);
    const to = dropAt > from ? dropAt - 1 : dropAt;
    setDragId(null);
    setDropAt(null);
    if (from < 0 || to === from) return;
    reorder(moveRow(o, from, to));
  };

  // ---- add row: pick exercise → type "4x6 @80% rest 2m" (or pick a scheme) → Enter
  const addRef = useRef<HTMLInputElement>(null);
  const rxRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ exercise: "", rx: "", scheme: "" });
  const patchFromRx = (rx: string): Omit<RowPatch, "title" | "block_title"> => {
    if (!rx.trim()) return {};
    const p = parsePrescription(rx);
    const v = p.load_type === "percent" ? p.percent : p.load_type === "rpe" ? p.rpe : p.load_type === "kg" ? p.load_kg : p.load_type === "velocity" ? p.velocity : null;
    return {
      sets: p.sets != null ? String(p.sets) : "",
      reps: p.reps ?? "",
      load_type: p.load_type,
      load_value: v != null ? String(v) : "",
      rest: p.rest_sec != null ? String(p.rest_sec) : "",
      ...(p.tempo ? { tempo: p.tempo } : {}),
      ...(p.notes ? { notes: p.notes } : {}),
    };
  };
  const addOne = async (name: string, rx: string, scheme: string) => {
    const r = await builderAdd(table, parentId, { kind: "exercise", exercise: name, ...patchFromRx(rx) }, back);
    if (r.error || !scheme || !r.data) return r;
    const added = r.data[r.data.length - 1];
    const s2 = await builderApplyScheme(table, parentId, added.id, scheme, back);
    if (s2.error) return { error: s2.error };
    setNotice(schemeNotice("x", s2.data!));
    return r;
  };
  const submitDraft = () =>
    withExercise(draft.exercise, (name) =>
      run(async () => {
        setNotice(null);
        const r = await addOne(name, draft.rx, draft.scheme);
        if (!r.error) {
          setDraft((d) => ({ ...d, exercise: "", rx: "" }));
          setTimeout(() => addRef.current?.focus(), 0);
        }
        return r;
      }),
    );
  const pasteLines = (lines: string[]) => {
    const names = lib.filter((e) => e.active).map((e) => e.name);
    const rows = lines.map((l) => splitLine(l, names)).filter((x): x is { exercise: string; rx: string } => !!x).slice(0, 30);
    const unknown = rows.filter((r) => !known.has(r.exercise.toLowerCase())).map((r) => r.exercise);
    run(async () => {
      setNotice(null);
      let last: { error?: string; data?: ItemFields[] } = {};
      for (const r of rows.filter((x) => known.has(x.exercise.toLowerCase()))) {
        last = await addOne(r.exercise, r.rx, "");
        if (last.error) return last;
      }
      if (unknown.length) setNotice(`Added ${rows.length - unknown.length}. Not in your library yet: ${unknown.join(", ")}. Type each one above to add it.`);
      else setNotice(`Added ${rows.length} exercise${rows.length === 1 ? "" : "s"}.`);
      return last;
    });
  };

  // group rows into blocks for display
  const groups: { block: string; rows: { i: ItemFields; k: number }[] }[] = [];
  items.forEach((i, k) => {
    const g = groups[groups.length - 1];
    if (g && g.block === i.block) g.rows.push({ i, k });
    else groups.push({ block: i.block, rows: [{ i, k }] });
  });

  const DropLine = ({ at }: { at: number }) => (dragId && dropAt === at ? <div className="my-0.5 h-1 rounded-full bg-brand" /> : null);

  return (
    <div className={busy ? "cursor-progress" : ""}>


      {items.length === 0 && (
        <p className="mb-4 rounded-xl border border-dashed border-line p-4 text-center text-muted">Rest day. Add the first exercise below.</p>
      )}

      <div className="space-y-2" onDragEnd={() => { setDragId(null); setDropAt(null); }}>
        {groups.map((g) => {
          const isSuper = g.rows.length > 1;
          const first = g.rows[0].i;
          return (
            <div key={g.block + first.id} className={`rounded-2xl ${isSuper ? "border border-brand/50 bg-brand/5 p-1.5" : ""}`}>
              {(isSuper || first.block_title) && (
                <div className="flex items-center gap-2 px-2 pb-1 pt-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-brand">{isSuper ? `Superset ${g.block}` : `Block ${g.block}`}</span>
                  <input
                    defaultValue={first.block_title ?? ""}
                    placeholder="Label (optional)"
                    maxLength={60}
                    onBlur={(e) => {
                      if ((e.target.value || null) !== (first.block_title ?? null)) save(first.id, { block_title: e.target.value });
                    }}
                    className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-xs text-muted hover:border-line focus:border-brand focus:outline-none"
                    aria-label={`Label for block ${g.block}`}
                  />
                </div>
              )}
              <div className="space-y-1">
                {g.rows.map(({ i, k }) => (
                  <div key={i.id}>
                    <DropLine at={k} />
                    <Row
                      i={i}
                      k={k}
                      label={itemLabel(i, sizes.get(i.block) ?? 1)}
                      name={i.kind === "exercise" ? exName.get(i.exercise_id!) ?? "" : i.title ?? ""}
                      lib={lib}
                      onUnits={(exId, key, value) =>
                        start(async () => {
                          setError(null);
                          const r = await builderSetUnits(exId, key, value, back);
                          if (r.error) return setError(r.error);
                          setLib((l) => l.map((e) => (e.id === exId ? { ...e, [key]: value } : e)));
                          setNotice("Unit saved for this exercise everywhere.");
                        })
                      }
                      selecting={sel.size > 0}
                      schemes={schemes}
                      onScheme={(schemeId) =>
                        start(async () => {
                          setError(null);
                          setNotice(null);
                          const r = await builderApplyScheme(table, parentId, i.id, schemeId, back);
                          if (r.error) return setError(r.error);
                          setNotice(schemeNotice(schemeId, r.data!));
                        })
                      }
                      checked={sel.has(i.id)}
                      open={open === i.id}
                      dragging={dragId === i.id}
                      last={k === items.length - 1}
                      onCheck={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(i.id); else n.delete(i.id); return n; })}
                      onToggle={() => setOpen(open === i.id ? null : i.id)}
                      onSave={(p) => {
                        if (p.exercise !== undefined) withExercise(p.exercise, (n) => save(i.id, { ...p, exercise: n }));
                        else save(i.id, p);
                      }}
                      onMove={(d) => reorder(moveRow(orderOf(items), k, Math.max(0, Math.min(items.length - 1, k + d))))}
                      onDup={() => run(() => builderDuplicate(table, parentId, i.id, back))}
                      onDelete={() => run(() => builderDelete(table, parentId, [i.id], back))}
                      onApplyWeeks={
                        table === "program_items" && i.kind === "exercise"
                          ? (opts) =>
                              start(async () => {
                                setError(null);
                                setNotice(null);
                                const r = await builderApplyWeeks(parentId, i.id, opts, back);
                                if (r.error) setError(r.error);
                                else
                                  setNotice(
                                    r.data!.weeks.length
                                      ? `Applied to week${r.data!.weeks.length > 1 ? "s" : ""} ${r.data!.weeks.join(", ")}.`
                                      : "No later weeks to apply to.",
                                  );
                              })
                          : undefined
                      }
                      dragProps={{
                        draggable: true,
                        onDragStart: (e: React.DragEvent) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", i.id);
                          setDragId(i.id);
                        },
                      }}
                      dropProps={{ onDragOver: (e: React.DragEvent) => onDragOver(e, k), onDrop }}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <DropLine at={items.length} />
      </div>

      {/* Selection toolbar */}
      {sel.size > 0 && (
        <div className="sticky bottom-20 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-brand bg-surface p-2 shadow-lg lg:bottom-4">
          <span className="px-2 text-sm font-bold">{sel.size} selected</span>
          <button onClick={makeSuperset} disabled={sel.size < 2} className="flex min-h-10 items-center gap-1.5 rounded-xl bg-brand px-3 text-sm font-extrabold text-white disabled:opacity-40">
            <Link2 size={16} /> Superset
          </button>
          <button onClick={split} className="flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-bold">
            <Unlink size={16} /> Split
          </button>
          <button onClick={() => setNaming("")} className="flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-bold">
            <BookmarkPlus size={16} /> Save as block
          </button>
          <button onClick={removeSelected} className="flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-bold text-brand">
            <Trash2 size={16} /> Delete
          </button>
          <button onClick={() => setSel(new Set())} className="ml-auto min-h-10 px-3 text-sm text-muted">Clear</button>
          {naming !== null && (
            <form
              className="flex w-full gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const ids = items.filter((i) => sel.has(i.id)).map((i) => i.id);
                start(async () => {
                  const r = await saveBlock(table, parentId, ids, naming);
                  if (r.error) return setError(r.error);
                  setSaved((l) => [...l, r.data!].sort((a, b) => a.name.localeCompare(b.name)));
                  setNaming(null);
                  setSel(new Set());
                  setNotice(`Saved "${r.data!.name}". Insert it from Saved blocks under any workout.`);
                });
              }}
            >
              <input autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} placeholder="Block name, e.g. Neck circuit" maxLength={60} className={`${box} flex-1`} aria-label="Block name" />
              <button className="h-10 rounded-lg bg-brand px-3 text-sm font-extrabold text-white">Save</button>
              <button type="button" onClick={() => setNaming(null)} className="h-10 px-2 text-sm text-muted">Cancel</button>
            </form>
          )}
        </div>
      )}

      {notice && <p className="mt-3 rounded-xl border border-ok/50 bg-ok/10 px-3 py-2 text-sm">{notice}</p>}
      {error && <p className="mt-3 rounded-xl border border-brand/50 bg-brand/10 px-3 py-2 text-sm">{error}</p>}

      {missing && (
        <QuickAdd
          name={missing.name}
          onCancel={() => setMissing(null)}
          onAdd={(name, cat) =>
            start(async () => {
              const r = await quickAddExercise(name, cat);
              if (r.error) return setError(r.error);
              setLib((l) => [...l, { id: r.data!.id, name: r.data!.name, active: true }]);
              const then = missing.then;
              setMissing(null);
              then(r.data!.name);
            })
          }
        />
      )}

      {/* Add row */}
      <div className="mt-4 rounded-2xl border border-line bg-surface p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitDraft();
          }}
          className="grid gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_170px_auto]"
        >
          <ExercisePicker
            ref={addRef}
            lib={lib}
            categories={CATS as unknown as [string, string][]}
            value={draft.exercise}
            onChange={(v) => setDraft({ ...draft, exercise: v })}
            onPick={(name) => {
              setDraft((d) => ({ ...d, exercise: name }));
              setTimeout(() => rxRef.current?.focus(), 0);
            }}
            onPasteLines={pasteLines}
            placeholder="Add exercise (rdl, db bench…)"
          />
          <input
            ref={rxRef}
            value={draft.rx}
            onChange={(e) => setDraft({ ...draft, rx: e.target.value })}
            placeholder="4x6 @80% rest 2m (blank = default)"
            className={box}
            aria-label="Sets, reps, load"
          />
          <select value={draft.scheme} onChange={(e) => setDraft({ ...draft, scheme: e.target.value })} className={box} aria-label="Loading scheme (optional)">
            <option value="">No scheme</option>
            {schemes.map((sc) => (
              <option key={sc.id} value={sc.id}>{sc.name}</option>
            ))}
          </select>
          <button className="flex h-10 items-center justify-center gap-1 rounded-lg bg-brand px-4 text-sm font-extrabold uppercase text-white">
            <Plus size={16} /> Add
          </button>
        </form>
        <p className="mt-1.5 text-[11px] text-muted">
          Shorthand: <b>4x6 @80%</b> · <b>3x8 rpe 7</b> · <b>3x10 @40kg</b> · <b>3x30s</b> · <b>rest 90s</b> · <b>tempo 31X1</b>. Paste a whole session (one exercise per line) into the search box.
        </p>
        {saved.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">Saved blocks</span>
            {saved.map((b) => (
              <span key={b.id} className="inline-flex items-center rounded-full border border-line bg-surface-2">
                <button onClick={() => run(() => insertBlock(table, parentId, b.id, back))} className="min-h-9 pl-3 pr-1 text-xs font-bold hover:text-brand" title="Add to the end of this workout">
                  + {b.name} <span className="font-normal text-muted">({b.count})</span>
                </button>
                <button
                  onClick={() =>
                    start(async () => {
                      const r = await deleteSavedBlock(b.id);
                      if (r.error) setError(r.error);
                      else setSaved((l) => l.filter((x) => x.id !== b.id));
                    })
                  }
                  className="flex h-9 w-8 items-center justify-center text-muted hover:text-brand"
                  aria-label={`Delete saved block ${b.name}`}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => run(() => builderAdd(table, parentId, { kind: "text", title: "Warm-up", notes: "" }, back))}
          className="mt-2 text-sm font-bold text-muted underline underline-offset-4"
        >
          + Add a text block (warm-up, conditioning, finisher)
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Click a line to edit it. Hover for the tick box (superset, save as block) and drag handle. <a href="/coach/library/schemes" className="underline">Loading schemes</a>
      </p>
    </div>
  );
}

function summary(i: ItemFields): string {
  if (i.set_plan?.length) return formatSetPlan(i.set_plan);
  return formatPrescription({
    sets: i.sets,
    reps: i.reps,
    load_type: (i.load_type ?? "none") as never,
    percent: i.percent != null ? Number(i.percent) : null,
    rpe: i.rpe != null ? Number(i.rpe) : null,
    load_kg: i.load_kg != null ? Number(i.load_kg) : null,
    velocity: i.velocity != null ? Number(i.velocity) : null,
    rest_sec: null,
    tempo: null,
  });
}

function Row({
  i,
  k,
  label,
  name,
  lib,
  checked,
  selecting,
  open,
  dragging,
  last,
  schemes,
  onCheck,
  onToggle,
  onSave,
  onMove,
  onDup,
  onDelete,
  onApplyWeeks,
  onScheme,
  onUnits,
  dragProps,
  dropProps,
}: {
  i: ItemFields;
  k: number;
  label: string;
  name: string;
  lib: LibEx[];
  checked: boolean;
  selecting: boolean;
  open: boolean;
  dragging: boolean;
  last: boolean;
  schemes: { id: string; name: string; weeks: number }[];
  onCheck: (v: boolean) => void;
  onToggle: () => void;
  onSave: (p: RowPatch) => void;
  onMove: (d: -1 | 1) => void;
  onDup: () => void;
  onDelete: () => void;
  onApplyWeeks?: (o: { mode: "same" | "load" | "reps" | "sets"; step: string; skipLast: boolean }) => void;
  onScheme: (schemeId: string | null) => void;
  onUnits: (exerciseId: string, key: "distance_unit" | "speed_unit", value: string) => void;
  dragProps: Record<string, unknown>;
  dropProps: Record<string, unknown>;
}) {
  const [loadType, setLoadType] = useState<string>(i.load_type ?? "none");
  const [exName, setExName] = useState(name);
  useEffect(() => setExName(name), [name]);
  const blur = (key: keyof RowPatch, was: string) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.target.value.trim() !== was) onSave({ [key]: e.target.value } as RowPatch);
  };
  const enter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") onToggle();
  };
  const text = i.kind === "text";
  const rx = text ? "" : summary(i);
  const extra = [i.rest_sec ? `rest ${formatRest(i.rest_sec)}` : null, i.tempo ? `tempo ${i.tempo}` : null].filter(Boolean).join(" · ");

  return (
    <div {...dropProps} className={`group rounded-xl border bg-surface transition-colors ${checked ? "border-brand" : open ? "border-line" : "border-transparent hover:border-line"} ${dragging ? "opacity-40" : ""}`}>
      {/* Read view: one clean line */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          className={`h-4 w-4 shrink-0 accent-[var(--color-brand)] ${selecting || checked ? "" : "md:opacity-0 md:group-hover:opacity-100"}`}
          aria-label={`Select ${name || "row"}`}
        />
        <span {...dragProps} className="hidden cursor-grab text-muted opacity-0 active:cursor-grabbing group-hover:opacity-100 md:block" title="Drag to reorder" aria-label="Drag to reorder">
          <GripVertical size={16} />
        </span>
        <span className="w-7 shrink-0 text-center text-sm font-black text-brand">{label}</span>
        <button type="button" onClick={onToggle} className="flex min-h-9 min-w-0 flex-1 items-center gap-x-3 gap-y-0.5 text-left max-md:flex-col" aria-expanded={open}>
          <span className="truncate font-bold">{text ? i.title || "Text" : name}</span>
          <span className="shrink-0 text-sm tabular-nums">{rx || (text ? "" : <span className="text-muted">Set sets &amp; reps</span>)}</span>
          {extra && <span className="shrink-0 text-xs text-muted">{extra}</span>}
          {i.set_plan?.length ? <span className="shrink-0 rounded bg-brand/15 px-1.5 text-[10px] font-bold uppercase text-brand">scheme</span> : null}
          {i.notes && <span className="truncate text-xs italic text-muted">{i.notes}</span>}
        </button>
        <span className="flex shrink-0 items-center md:opacity-0 md:group-hover:opacity-100">
          <span className="flex flex-col md:hidden">
            <button onClick={() => onMove(-1)} disabled={k === 0} className="h-5 text-muted disabled:opacity-20" aria-label="Move up"><ArrowUp size={15} /></button>
            <button onClick={() => onMove(1)} disabled={last} className="h-5 text-muted disabled:opacity-20" aria-label="Move down"><ArrowDown size={15} /></button>
          </span>
          <button onClick={onToggle} className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 md:flex" title="Edit" aria-label="Edit"><Pencil size={15} /></button>
          <button onClick={onDup} className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 md:flex" title="Duplicate" aria-label="Duplicate"><Copy size={15} /></button>
          <button onClick={onDelete} className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-brand md:flex" title="Delete" aria-label="Delete"><Trash2 size={15} /></button>
        </span>
      </div>

      {/* Edit view */}
      {open && (
        <div className="space-y-2 border-t border-line p-3">
          {text ? (
            <>
              <input defaultValue={i.title ?? ""} onBlur={blur("title", i.title ?? "")} onKeyDown={enter} placeholder="Title" className={`${box} font-bold`} aria-label="Title" />
              <textarea defaultValue={i.notes ?? ""} onBlur={blur("notes", i.notes ?? "")} rows={4} maxLength={2000} placeholder="10 × 30s on / 30s off @ 120% MAS" className={`${box} h-auto py-2`} aria-label="Notes" />
            </>
          ) : (
            <>
              <ExercisePicker
                lib={lib}
                categories={CATS as unknown as [string, string][]}
                value={exName}
                onChange={setExName}
                onPick={(n) => n !== name && onSave({ exercise: n })}
              />
              <div className="grid grid-cols-2 gap-2 md:grid-cols-[70px_90px_190px_90px_110px]">
                <label className="text-[11px] text-muted">Sets<input defaultValue={i.sets ?? ""} onBlur={blur("sets", String(i.sets ?? ""))} onKeyDown={enter} inputMode="numeric" className={box} /></label>
                <label className="text-[11px] text-muted">Reps<input defaultValue={i.reps ?? ""} onBlur={blur("reps", i.reps ?? "")} onKeyDown={enter} placeholder="8-10, 30s" className={box} /></label>
                <label className="col-span-2 text-[11px] text-muted md:col-span-1">Load
                  <span className="flex gap-1">
                    <select
                      value={loadType}
                      onChange={(e) => {
                        setLoadType(e.target.value);
                        if (e.target.value === "none" || e.target.value === "bodyweight") onSave({ load_type: e.target.value, load_value: "" });
                      }}
                      className={`${box} !w-[80px] shrink-0 !px-1`}
                      aria-label="Load type"
                    >
                      {LOADS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input
                      key={loadType}
                      defaultValue={loadType === i.load_type ? loadValue(i) : ""}
                      onBlur={(e) => {
                        if (loadType === "none" || loadType === "bodyweight") return;
                        if (e.target.value.trim() === "" && loadType !== i.load_type) return;
                        if (e.target.value.trim() !== loadValue(i) || loadType !== i.load_type) onSave({ load_type: loadType, load_value: e.target.value });
                      }}
                      onKeyDown={enter}
                      inputMode="decimal"
                      disabled={loadType === "none" || loadType === "bodyweight"}
                      className={`${box} disabled:opacity-40`}
                      aria-label="Load"
                    />
                  </span>
                </label>
                <label className="text-[11px] text-muted">Rest<input defaultValue={restText(i.rest_sec)} onBlur={blur("rest", restText(i.rest_sec))} onKeyDown={enter} placeholder="90s, 2m" className={box} /></label>
                <label className="text-[11px] text-muted">Tempo<input defaultValue={i.tempo ?? ""} onBlur={blur("tempo", i.tempo ?? "")} onKeyDown={enter} placeholder="31X1" className={box} /></label>
              </div>
              <input defaultValue={i.notes ?? ""} onBlur={blur("notes", i.notes ?? "")} onKeyDown={enter} placeholder="Coaching note the client sees" className={box} aria-label="Notes" />
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2 p-2">
                <span className="text-xs font-bold">Loading scheme</span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value === "__clear") onScheme(null);
                    else if (e.target.value) onScheme(e.target.value);
                    e.target.value = "";
                  }}
                  className={`${box} !w-64`}
                  aria-label="Apply a loading scheme"
                >
                  <option value="">{i.set_plan?.length ? "Change scheme…" : "Apply a scheme…"}</option>
                  {schemes.map((sc) => <option key={sc.id} value={sc.id}>{sc.name} ({sc.weeks} wk)</option>)}
                  {i.set_plan?.length ? <option value="__clear">Remove scheme from this line</option> : null}
                </select>
                <span className="text-[11px] text-muted">Fills this line and the same exercise on this day in later weeks. Typing sets or reps by hand replaces it.</span>
              </div>
              <RecordFields i={i} ex={lib.find((e) => e.id === i.exercise_id)} onSave={onSave} onUnits={onUnits} />
              {onApplyWeeks && <ApplyWeeks onApply={onApplyWeeks} loadType={i.load_type ?? "none"} />}
            </>
          )}
          <div className="flex items-center gap-2">
            <button onClick={onToggle} className="min-h-9 rounded-lg bg-text px-3 text-sm font-bold text-ink">Done</button>
            <button onClick={onDup} className="flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-bold md:hidden"><Copy size={14} /> Duplicate</button>
            <button onClick={onDelete} className="flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-bold text-brand md:hidden"><Trash2 size={14} /> Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

const UNIT_OPTS = {
  distance_unit: [["m", "metres"], ["km", "km"], ["mi", "miles"], ["yd", "yards"]],
  speed_unit: [["ms", "m/s"], ["kmh", "km/h"], ["mph", "mph"]],
} as const;

/** What the client logs each set, plus distance/speed units when those are picked. */
function RecordFields({ i, ex, onSave, onUnits }: { i: ItemFields; ex?: LibEx; onSave: (p: RowPatch) => void; onUnits: (exerciseId: string, key: "distance_unit" | "speed_unit", value: string) => void }) {
  const eff = fieldsFor({ fields: ex?.fields ?? null, measure: ex?.measure ?? "load" }, i);
  const custom = !!i.fields?.length;
  const full = eff.length >= MAX_FIELDS;
  return (
    <details>
      <summary className="cursor-pointer text-xs text-muted">
        What the client records: <span className="font-bold text-text">{eff.map((f) => FIELD_LABEL[f]).join(", ")}</span>
      </summary>
      <div className="mt-1 flex flex-wrap gap-1">
        {FIELD_KEYS.map((f) => {
          const on = eff.includes(f);
          return (
            <button
              key={f}
              type="button"
              disabled={!on && full}
              onClick={() => {
                const next = on ? eff.filter((x) => x !== f) : [...eff, f];
                onSave({ fields: next.length ? next : [] });
              }}
              className={`min-h-8 rounded-full border px-2.5 text-[11px] font-bold disabled:opacity-40 ${on ? "border-brand bg-brand text-white" : "border-line text-muted"}`}
            >
              {FIELD_LABEL[f as FieldKey]}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Up to {MAX_FIELDS}. {custom ? "Set for this line only." : "Using the exercise's default."}
        {custom && (
          <button type="button" onClick={() => onSave({ fields: [] })} className="ml-1 font-bold underline">Reset to default</button>
        )}
      </p>
      {ex && (eff.includes("distance") || eff.includes("speed")) && (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted">
          {(["distance_unit", "speed_unit"] as const)
            .filter((k) => eff.includes(k === "distance_unit" ? "distance" : "speed"))
            .map((k) => (
              <label key={k} className="flex items-center gap-1">
                {k === "distance_unit" ? "Distance in" : "Speed in"}
                <select
                  value={ex[k] ?? (k === "distance_unit" ? "m" : "ms")}
                  onChange={(e) => onUnits(ex.id, k, e.target.value)}
                  className="min-h-8 rounded-lg border border-line bg-surface px-2 text-xs font-bold text-text"
                >
                  {UNIT_OPTS[k].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            ))}
          <span>Applies to this exercise everywhere.</span>
        </div>
      )}
    </details>
  );
}

function QuickAdd({ name, onCancel, onAdd }: { name: string; onCancel: () => void; onAdd: (name: string, cat: string) => void }) {
  const [n, setN] = useState(name);
  const [cat, setCat] = useState("auto");
  return (
    <div className="mt-3 rounded-2xl border border-warn/60 bg-warn/10 p-3">
      <p className="mb-2 text-sm">
        <b>{name}</b> isn&apos;t in your exercise library. Add it now? You can add a video later in the library.
      </p>
      <div className="flex flex-wrap gap-2">
        <input value={n} onChange={(e) => setN(e.target.value)} className={`${box} min-w-40 flex-1`} aria-label="Exercise name" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${box} !w-44`} aria-label="Category">
          <option value="auto">Sort it for me</option>
          {CATS.map(([c, l]) => (
            <option key={c} value={c}>{l}</option>
          ))}
        </select>
        <button onClick={() => onAdd(n, cat)} className="h-10 rounded-lg bg-brand px-4 text-sm font-extrabold uppercase text-white">Add & use</button>
        <button onClick={onCancel} className="h-10 px-3 text-sm text-muted">Cancel</button>
      </div>
    </div>
  );
}

function ApplyWeeks({ onApply, loadType }: { onApply: (o: { mode: "same" | "load" | "reps" | "sets"; step: string; skipLast: boolean }) => void; loadType: string }) {
  const def = loadType === "percent" ? "2.5" : loadType === "kg" ? "2.5" : loadType === "rpe" ? "0.5" : loadType === "velocity" ? "0.05" : "1";
  const [mode, setMode] = useState<"same" | "load" | "reps" | "sets">(loadType === "none" || loadType === "bodyweight" ? "same" : "load");
  const [step, setStep] = useState(def);
  const [skipLast, setSkipLast] = useState(false);
  const unit = mode === "load" ? (loadType === "percent" ? "% / week" : loadType === "kg" ? "kg / week" : loadType === "rpe" ? "RPE / week" : loadType === "velocity" ? "m/s slower / week" : "") : mode === "reps" ? "reps / week" : mode === "sets" ? "sets / week" : "";
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-2">
      <p className="mb-1.5 text-xs font-bold">Copy this line to the same day in later weeks</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={`${box} !w-44`} aria-label="Progression">
          <option value="same">Same every week</option>
          <option value="load" disabled={loadType === "none" || loadType === "bodyweight"}>Add load each week</option>
          <option value="reps">Add reps each week</option>
          <option value="sets">Add sets each week</option>
        </select>
        {mode !== "same" && (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input value={step} onChange={(e) => setStep(e.target.value)} inputMode="decimal" className={`${box} !w-16`} aria-label="Step" />
            {unit}
          </label>
        )}
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={skipLast} onChange={(e) => setSkipLast(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
          Leave the last week (deload)
        </label>
        <button onClick={() => onApply({ mode, step, skipLast })} className="h-10 rounded-lg bg-brand px-3 text-sm font-extrabold text-white">
          Apply
        </button>
      </div>
    </div>
  );
}
