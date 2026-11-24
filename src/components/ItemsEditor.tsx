// Coach editor for a day's prescription lines (program day or dated workout).
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { formatPrescription, itemLabel } from "@/lib/prescription";
import { blockTitle, byBlock, type ItemFields } from "@/lib/programming/types";
import {
  addItem,
  deleteItem,
  moveItem,
  reletterItems,
  setBlockTitle,
  updateItem,
} from "@/app/coach/items-actions";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";
const iconBtn =
  "flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted";

/** The one-line text that round-trips through the parser. */
function lineFor(i: ItemFields) {
  const base = formatPrescription({
    sets: i.sets,
    reps: i.reps,
    load_type: i.load_type,
    percent: i.percent != null ? Number(i.percent) : null,
    rpe: i.rpe != null ? Number(i.rpe) : null,
    load_kg: i.load_kg != null ? Number(i.load_kg) : null,
    tempo: i.tempo,
    rest_sec: i.rest_sec,
  })
    .replace(/ × /, "x")
    .replace(/(\d) min$/, "$1m")
    .replace(/(\d) min /, "$1m ");
  const extraKg =
    i.load_type === "percent" && i.load_kg != null ? ` ${Number(i.load_kg)}kg` : "";
  return [base + extraKg, i.notes].filter(Boolean).join(" ").trim();
}

export function ItemsEditor({
  table,
  parentId,
  back,
  items,
  exercises,
}: {
  table: "program_items" | "workout_items";
  parentId: string;
  back: string;
  items: ItemFields[];
  exercises: { id: string; name: string; active: boolean }[];
}) {
  const exName = new Map(exercises.map((e) => [e.id, e.name]));
  const hidden = (
    <>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="parent_id" value={parentId} />
      <input type="hidden" name="back" value={back} />
    </>
  );
  const blocks = byBlock(items);

  return (
    <div>
      <datalist id="exercise-list">
        {exercises
          .filter((e) => e.active)
          .map((e) => (
            <option key={e.id} value={e.name} />
          ))}
      </datalist>

      {items.length === 0 && (
        <p className="mb-4 rounded-xl border border-dashed border-line p-4 text-center text-muted">
          Rest day. Add an exercise or a text block below.
        </p>
      )}

      <div className="space-y-4">
        {blocks.map(([letter, list]) => (
          <section key={letter} className="rounded-2xl border border-line bg-surface p-3">
            <details className="mb-2">
              <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-widest text-brand">
                {blockTitle(list) ? `${letter}: ${blockTitle(list)}` : list.length > 1 ? `Superset ${letter}` : `Block ${letter}`}
                <span className="ml-2 font-normal normal-case tracking-normal text-muted">· label</span>
              </summary>
              <form action={setBlockTitle} className="mt-2 flex gap-2">
                {hidden}
                <input type="hidden" name="block" value={letter} />
                <input
                  name="block_title"
                  defaultValue={blockTitle(list) ?? ""}
                  maxLength={60}
                  placeholder="Block label, e.g. Power, Finisher"
                  className={input}
                  aria-label="Block label"
                />
                <button className={smallBtn}>Save</button>
              </form>
            </details>
            <div className="space-y-2">
              {list.map((i) => (
                <details
                  key={i.id}
                  id={`item-${i.id}`}
                  className="scroll-mt-6 rounded-xl bg-surface-2 p-3"
                >
                  <summary className="flex cursor-pointer list-none items-start gap-3">
                    <span className="mt-0.5 w-8 shrink-0 font-black text-brand">
                      {itemLabel(i, list.length)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">
                        {i.kind === "text" ? i.title ?? "Notes" : exName.get(i.exercise_id!) ?? "Exercise"}
                      </span>
                      <span className="block text-sm text-muted">
                        {i.kind === "text"
                          ? i.notes?.split("\n")[0]
                          : formatPrescription({
                              ...i,
                              percent: i.percent != null ? Number(i.percent) : null,
                              rpe: i.rpe != null ? Number(i.rpe) : null,
                              load_kg: i.load_kg != null ? Number(i.load_kg) : null,
                            }) || "No prescription"}
                        {i.kind === "exercise" && i.notes ? ` · ${i.notes}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-muted">Edit</span>
                  </summary>

                  <form action={updateItem} className="mt-3 space-y-2">
                    {hidden}
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="kind" value={i.kind} />
                    {i.kind === "exercise" ? (
                      <>
                        <input
                          name="exercise"
                          list="exercise-list"
                          defaultValue={exName.get(i.exercise_id!) ?? ""}
                          className={input}
                          aria-label="Exercise"
                        />
                        <input
                          name="line"
                          defaultValue={lineFor(i)}
                          placeholder="4x5 @ 80% rest 3m"
                          className={input}
                          aria-label="Prescription"
                        />
                      </>
                    ) : (
                      <>
                        <input
                          name="title"
                          defaultValue={i.title ?? ""}
                          placeholder="Title (e.g. Warm-up, ESD)"
                          maxLength={80}
                          className={input}
                          aria-label="Title"
                        />
                        <textarea
                          name="notes"
                          defaultValue={i.notes ?? ""}
                          rows={4}
                          maxLength={2000}
                          className={`${input} py-2`}
                          aria-label="Notes"
                        />
                      </>
                    )}
                    <div className="flex gap-2">
                      <label className="flex items-center gap-2 text-sm text-muted">
                        Block
                        <input
                          name="block"
                          defaultValue={i.block}
                          maxLength={1}
                          className={`${input} !w-14 text-center uppercase`}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm text-muted">
                        Slot
                        <input
                          name="slot"
                          type="number"
                          min={1}
                          max={9}
                          defaultValue={i.slot}
                          className={`${input} !w-16 text-center`}
                        />
                      </label>
                      <button className={`${smallBtn} ml-auto`}>Save</button>
                    </div>
                  </form>
                  <div className="mt-2 flex gap-2">
                    {(["up", "down"] as const).map((dir) => (
                      <form key={dir} action={moveItem}>
                        {hidden}
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="dir" value={dir} />
                        <button className={iconBtn} aria-label={`Move ${dir}`}>
                          {dir === "up" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </form>
                    ))}
                    <form action={deleteItem} className="ml-auto">
                      {hidden}
                      <input type="hidden" name="id" value={i.id} />
                      <button className={`${iconBtn} !text-brand`} aria-label="Delete">
                        <Trash2 size={18} />
                      </button>
                    </form>
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      {items.length > 1 && (
        <form action={reletterItems} className="mt-2 text-right">
          {hidden}
          <button className="text-sm text-muted underline underline-offset-4">
            Re-letter blocks A, B, C…
          </button>
        </form>
      )}

      <div className="mt-6 rounded-2xl border border-brand/50 bg-surface p-4">
        <h2 className="mb-3 font-extrabold">Add exercise</h2>
        <form action={addItem} className="space-y-2">
          {hidden}
          <input type="hidden" name="kind" value="exercise" />
          <input
            name="exercise"
            list="exercise-list"
            placeholder="Start typing an exercise"
            required
            className={input}
            aria-label="Exercise"
          />
          <input
            name="line"
            placeholder="4x5 @ 80% rest 3m"
            className={input}
            aria-label="Prescription"
          />
          <p className="text-xs text-muted">
            Examples: 4x5 @ 80% · 3x8 RPE 7 · 3x10 @ 40kg · 3x8-10 · 3x30s ·
            tempo 31X1 · rest 90s. Anything else is kept as a note.
          </p>
          {items.length > 0 && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="superset"
                className="h-5 w-5 accent-[var(--color-brand)]"
              />
              Superset with the last exercise
            </label>
          )}
          <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">
            Add
          </button>
        </form>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-bold text-muted">
            + Add a text block (warm-up, conditioning, finisher)
          </summary>
          <form action={addItem} className="mt-3 space-y-2">
            {hidden}
            <input type="hidden" name="kind" value="text" />
            <input
              name="title"
              placeholder="Title, e.g. ESD: Assault Bike"
              maxLength={80}
              className={input}
              aria-label="Title"
            />
            <textarea
              name="notes"
              rows={4}
              maxLength={2000}
              placeholder={"10 × 30s on / 30s off @ 120% MAS"}
              className={`${input} py-2`}
              aria-label="Notes"
            />
            <button className={smallBtn}>Add block</button>
          </form>
        </details>
      </div>
    </div>
  );
}
