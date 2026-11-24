"use client";
// Spreadsheet-style builder for a day's exercises (program day or dated workout).
// Tick rows → "Superset". Drag the handle to reorder (arrows on phones). Every box saves when you leave it.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, BookmarkPlus, ChevronDown, Copy, GripVertical, Link2, Plus, Trash2, Unlink, X } from "lucide-react";
import { itemLabel } from "@/lib/prescription";
import { EXERCISE_CATEGORIES, type ItemFields } from "@/lib/programming/types";
import { FIELD_KEYS, FIELD_LABEL, type FieldKey } from "@/lib/programming/fields";
import {
  builderAdd,
  builderApplyWeeks,
  builderDelete,
  builderDuplicate,
  builderOrder,
  builderUpdate,
  deleteSavedBlock,
  insertBlock,
  listSavedBlocks,
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
  exercises: { id: string; name: string; active: boolean }[];
}) {
  const [items, setItems] = useState(initial);
  const [lib, setLib] = useState(exercises);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; name: string; count: number }[]>([]);
  const [naming, setNaming] = useState<string | null>(null);
  useEffect(() => {
    listSavedBlocks().then((r) => r.data && setSaved(r.data));
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

  // ---- add row
  const addRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ exercise: "", sets: "", reps: "", load_type: "none", load_value: "", rest: "" });
  const submitDraft = () =>
    withExercise(draft.exercise, (name) =>
      run(async () => {
        const r = await builderAdd(table, parentId, { kind: "exercise", ...draft, exercise: name }, back);
        if (!r.error) {
          setDraft((d) => ({ ...d, exercise: "" }));
          setTimeout(() => addRef.current?.focus(), 0);
        }
        return r;
      }),
    );

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
      <datalist id="exercise-list">
        {lib
          .filter((e) => e.active)
          .map((e) => (
            <option key={e.id} value={e.name} />
          ))}
      </datalist>

      {/* Column headings (desktop) */}
      {items.length > 0 && (
        <div className="mb-1 hidden grid-cols-[28px_20px_32px_minmax(0,1fr)_64px_80px_162px_72px_108px] gap-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted md:grid">
          <span />
          <span />
          <span />
          <span>Exercise</span>
          <span>Sets</span>
          <span>Reps</span>
          <span>Load</span>
          <span>Rest</span>
          <span />
        </div>
      )}

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
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Add exercise · leave boxes blank to use the exercise’s default · Enter adds the next</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitDraft();
          }}
          className="grid grid-cols-4 gap-2 md:grid-cols-[minmax(0,1fr)_64px_80px_162px_72px_auto]"
        >
          <input
            ref={addRef}
            value={draft.exercise}
            onChange={(e) => setDraft({ ...draft, exercise: e.target.value })}
            list="exercise-list"
            placeholder="Start typing an exercise"
            className={`${box} col-span-4 md:col-span-1`}
            aria-label="Exercise"
          />
          <input value={draft.sets} onChange={(e) => setDraft({ ...draft, sets: e.target.value })} inputMode="numeric" placeholder="Sets" className={box} aria-label="Sets" />
          <input value={draft.reps} onChange={(e) => setDraft({ ...draft, reps: e.target.value })} placeholder="Reps" className={box} aria-label="Reps" />
          <div className="col-span-2 flex gap-1 md:col-span-1">
            <select value={draft.load_type} onChange={(e) => setDraft({ ...draft, load_type: e.target.value })} className={`${box} !w-[76px] shrink-0 !px-1 md:!w-[84px]`} aria-label="Load type">
              {LOADS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input
              value={draft.load_value}
              onChange={(e) => setDraft({ ...draft, load_value: e.target.value })}
              inputMode="decimal"
              disabled={draft.load_type === "none" || draft.load_type === "bodyweight"}
              placeholder="—"
              className={`${box} disabled:opacity-40`}
              aria-label="Load"
            />
          </div>
          <input value={draft.rest} onChange={(e) => setDraft({ ...draft, rest: e.target.value })} placeholder="Rest" className={`${box} col-span-2 md:col-span-1`} aria-label="Rest" />
          <button className="col-span-2 flex h-10 items-center justify-center gap-1 rounded-lg bg-brand px-4 text-sm font-extrabold uppercase text-white md:col-span-1">
            <Plus size={16} /> Add
          </button>
        </form>
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
        Tick two or more rows and press <b>Superset</b>, or <b>Save as block</b> to reuse them. Drag <GripVertical size={12} className="inline" /> to reorder (drop inside a superset to join it). Rest: 90s, 2m or 1:30. Reps can be a range or time: 8-10, 30s, AMRAP.
      </p>
    </div>
  );
}

function Row({
  i,
  k,
  label,
  name,
  checked,
  open,
  dragging,
  last,
  onCheck,
  onToggle,
  onSave,
  onMove,
  onDup,
  onDelete,
  onApplyWeeks,
  dragProps,
  dropProps,
}: {
  i: ItemFields;
  k: number;
  label: string;
  name: string;
  checked: boolean;
  open: boolean;
  dragging: boolean;
  last: boolean;
  onCheck: (v: boolean) => void;
  onToggle: () => void;
  onSave: (p: RowPatch) => void;
  onMove: (d: -1 | 1) => void;
  onDup: () => void;
  onDelete: () => void;
  onApplyWeeks?: (o: { mode: "same" | "load" | "reps" | "sets"; step: string; skipLast: boolean }) => void;
  dragProps: Record<string, unknown>;
  dropProps: Record<string, unknown>;
}) {
  const [loadType, setLoadType] = useState<string>(i.load_type ?? "none");
  const blur = (key: keyof RowPatch, was: string) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.target.value.trim() !== was) onSave({ [key]: e.target.value } as RowPatch);
  };
  const enter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  };
  const text = i.kind === "text";

  return (
    <div {...dropProps} className={`rounded-xl border bg-surface ${checked ? "border-brand" : "border-line"} ${dragging ? "opacity-40" : ""}`}>
      <div className="grid grid-cols-[28px_20px_32px_minmax(0,1fr)_auto] items-center gap-2 p-2 md:grid-cols-[28px_20px_32px_minmax(0,1fr)_64px_80px_162px_72px_108px]">
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} className="h-5 w-5 justify-self-center accent-[var(--color-brand)]" aria-label={`Select ${name || "row"}`} />
        <span {...dragProps} className="hidden cursor-grab text-muted active:cursor-grabbing md:block" title="Drag to reorder" aria-label="Drag to reorder">
          <GripVertical size={18} />
        </span>
        <span className="flex flex-col md:hidden">
          <button onClick={() => onMove(-1)} disabled={k === 0} className="h-5 text-muted disabled:opacity-20" aria-label="Move up"><ArrowUp size={16} /></button>
          <button onClick={() => onMove(1)} disabled={last} className="h-5 text-muted disabled:opacity-20" aria-label="Move down"><ArrowDown size={16} /></button>
        </span>
        <span className="text-center font-black text-brand">{label}</span>
        {text ? (
          <input defaultValue={i.title ?? ""} onBlur={blur("title", i.title ?? "")} onKeyDown={enter} placeholder="Title" className={`${box} font-bold md:col-span-5`} aria-label="Title" />
        ) : (
          <input defaultValue={name} list="exercise-list" onBlur={blur("exercise", name)} onKeyDown={enter} className={`${box} font-bold`} aria-label="Exercise" />
        )}
        {/* phone: more button sits at row end */}
        <button onClick={onToggle} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted md:hidden" aria-label="More options">
          <ChevronDown size={18} className={open ? "rotate-180" : ""} />
        </button>
        {!text && (
          <div className="col-span-5 grid grid-cols-[1fr_1fr_2.6fr_1.2fr] gap-1.5 md:contents">
            <input defaultValue={i.sets ?? ""} onBlur={blur("sets", String(i.sets ?? ""))} onKeyDown={enter} inputMode="numeric" placeholder="Sets" className={box} aria-label="Sets" />
            <input defaultValue={i.reps ?? ""} onBlur={blur("reps", i.reps ?? "")} onKeyDown={enter} placeholder="Reps" className={box} aria-label="Reps" />
            <div className="flex gap-1">
              <select
                value={loadType}
                onChange={(e) => {
                  setLoadType(e.target.value);
                  if (e.target.value === "none" || e.target.value === "bodyweight") onSave({ load_type: e.target.value, load_value: "" });
                }}
                className={`${box} !w-[76px] shrink-0 !px-1 md:!w-[84px]`}
                aria-label="Load type"
              >
                {LOADS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
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
                placeholder="—"
                className={`${box} disabled:opacity-40`}
                aria-label="Load"
              />
            </div>
            <input defaultValue={restText(i.rest_sec)} onBlur={blur("rest", restText(i.rest_sec))} onKeyDown={enter} placeholder="Rest" className={box} aria-label="Rest" />
          </div>
        )}
        <div className="hidden items-center justify-end gap-0.5 md:flex">
          <button onClick={onToggle} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2" title="Tempo, notes, what to record" aria-label="More options">
            <ChevronDown size={18} className={open ? "rotate-180" : ""} />
          </button>
          <button onClick={onDup} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2" title="Duplicate" aria-label="Duplicate">
            <Copy size={16} />
          </button>
          <button onClick={onDelete} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-brand" title="Delete" aria-label="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-2 border-t border-line p-3">
          {!text && (
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <input defaultValue={i.tempo ?? ""} onBlur={blur("tempo", i.tempo ?? "")} onKeyDown={enter} placeholder="Tempo 31X1" className={box} aria-label="Tempo" />
              <input defaultValue={i.notes ?? ""} onBlur={blur("notes", i.notes ?? "")} onKeyDown={enter} placeholder="Coaching note the client sees" className={box} aria-label="Notes" />
            </div>
          )}
          {text && (
            <textarea
              defaultValue={i.notes ?? ""}
              onBlur={blur("notes", i.notes ?? "")}
              rows={4}
              maxLength={2000}
              placeholder="10 × 30s on / 30s off @ 120% MAS"
              className={`${box} h-auto py-2`}
              aria-label="Notes"
            />
          )}
          {!text && (
            <fieldset>
              <legend className="mb-1 text-xs text-muted">Client records (none ticked = the exercise&apos;s default)</legend>
              <div className="flex flex-wrap gap-1">
                {FIELD_KEYS.map((f) => {
                  const on = i.fields?.includes(f) ?? false;
                  return (
                    <button
                      key={f}
                      onClick={() => {
                        const cur = i.fields ?? [];
                        onSave({ fields: on ? cur.filter((x) => x !== f) : [...cur, f] });
                      }}
                      className={`min-h-8 rounded-full border px-2.5 text-[11px] font-bold ${on ? "border-brand bg-brand text-white" : "border-line text-muted"}`}
                    >
                      {FIELD_LABEL[f as FieldKey]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {onApplyWeeks && <ApplyWeeks onApply={onApplyWeeks} loadType={i.load_type ?? "none"} />}
          <div className="flex gap-2 md:hidden">
            <button onClick={onDup} className="flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-bold"><Copy size={14} /> Duplicate</button>
            <button onClick={onDelete} className="flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-bold text-brand"><Trash2 size={14} /> Delete</button>
          </div>
        </div>
      )}
    </div>
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
