import { allExerciseRows } from "@/lib/programming/all-exercises";
import Link from "next/link";
import { requireState } from "@/lib/session";
import { getLifts } from "@/lib/lift-data";
import {
  MEASURES,
  type Exercise,
} from "@/lib/programming/types";
import { Alert, Heading, Screen } from "@/components/ui";
import { FIELD_KEYS, FIELD_LABEL } from "@/lib/programming/fields";
import { EQUIPMENT_LIST, equipmentLabel } from "@/lib/programming/equipment";
import { labelOf, loadCategories, type Categories } from "@/lib/programming/categories-data";
import { addExercise, bulkExercises, setExerciseActive, updateExercise } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

function PatternSelect({ name, value, form, cats }: { name: string; value: string; form?: string; cats: Categories }) {
  return (
    <select name={name} form={form} defaultValue={value} className={input} aria-label="Category">
      {cats.cats.map(([c, l]) => (
        <optgroup key={c} label={l}>
          <option value={`${c}.`}>{l} (general)</option>
          {(cats.subs[c] ?? []).map(([k, sl]) => (
            <option key={k} value={`${c}.${k}`}>{l} › {sl}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function ExerciseFields({
  e,
  lifts,
  cats,
}: {
  e?: Exercise;
  lifts: { key: string; name: string }[];
  cats: Categories;
}) {
  return (
    <div className="space-y-3">
      <input
        name="name"
        defaultValue={e?.name}
        placeholder="e.g. Tempo Goblet Squat"
        maxLength={80}
        required
        className={input}
        aria-label="Exercise name"
      />
      <div className="grid grid-cols-2 gap-2">
        <PatternSelect name="pattern" cats={cats} value={e ? `${e.category}.${e.subcategory ?? ""}` : "accessory."} />
        <select
          name="measure"
          defaultValue={e?.measure ?? "load"}
          className={input}
          aria-label="Measured by"
        >
          {MEASURES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="rounded-xl border border-line p-3">
        <legend className="px-1 text-sm text-muted">Equipment needed (clients see this before the workout)</legend>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT_LIST.map(([k, l]) => (
            <label key={k} className="cursor-pointer">
              <input type="checkbox" name="equipment" value={k} defaultChecked={(e?.equipment ?? []).includes(k)} className="peer sr-only" />
              <span className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs font-bold text-muted peer-checked:border-brand peer-checked:bg-brand/15 peer-checked:text-text peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                {l}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">None ticked = bodyweight / no equipment.</p>
      </fieldset>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">
          Linked 1RM lift (lets % loads calculate from the client&apos;s e1RM)
        </span>
        <select name="lift_key" defaultValue={e?.lift_key ?? ""} className={input}>
          <option value="">None</option>
          {lifts.map((l) => (
            <option key={l.key} value={l.key}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="rounded-xl border border-line p-3">
        <legend className="px-1 text-sm text-muted">What to record each set (up to 4; none ticked = default for its type)</legend>
        <div className="flex flex-wrap gap-1.5">
          {FIELD_KEYS.map((k) => (
            <label key={k} className="cursor-pointer">
              <input type="checkbox" name="fields" value={k} defaultChecked={e?.fields?.includes(k)} className="peer sr-only" />
              <span className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs font-bold text-muted peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white">
                {FIELD_LABEL[k]}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted">
          <label>Weight in
            <select name="weight_unit" defaultValue={e?.weight_unit ?? "kg"} className={input}>
              <option value="kg">kg</option><option value="lb">lb</option>
            </select>
          </label>
          <label>Distance in
            <select name="distance_unit" defaultValue={e?.distance_unit ?? "m"} className={input}>
              <option value="m">metres</option><option value="km">km</option><option value="mi">miles</option>
            </select>
          </label>
          <label>Speed in
            <select name="speed_unit" defaultValue={e?.speed_unit ?? "ms"} className={input}>
              <option value="ms">m/s</option><option value="kmh">km/h</option><option value="mph">mph</option>
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset className="rounded-xl border border-line p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-widest text-muted">Default prescription (optional)</legend>
        <p className="mb-2 text-xs text-muted">Filled in automatically when you add this exercise to a workout. You can still change it there.</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-5">
          <label>Sets<input name="default_sets" defaultValue={e?.default_sets ?? ""} inputMode="numeric" className={input} /></label>
          <label>Reps<input name="default_reps" defaultValue={e?.default_reps ?? ""} placeholder="5, 8-10, 30s" className={input} /></label>
          <label>Load
            <select name="default_load_type" defaultValue={e?.default_load_type ?? "none"} className={input}>
              <option value="none">—</option><option value="percent">%1RM</option><option value="rpe">RPE</option><option value="kg">kg</option><option value="bodyweight">BW</option><option value="velocity">m/s</option>
            </select>
          </label>
          <label>Value<input name="default_load_value" defaultValue={e?.default_load_value ?? ""} inputMode="decimal" className={input} /></label>
          <label>Rest<input name="default_rest" defaultValue={e?.default_rest_sec != null ? (e.default_rest_sec >= 60 && e.default_rest_sec % 30 === 0 ? `${e.default_rest_sec / 60}m` : `${e.default_rest_sec}s`) : ""} placeholder="90s, 2m" className={input} /></label>
        </div>
      </fieldset>
      <input
        name="video_url"
        type="url"
        defaultValue={e?.video_url ?? ""}
        placeholder="Video link (YouTube, Vimeo…)"
        className={input}
        aria-label="Video link"
      />
      <input
        name="tags"
        defaultValue={(e?.tags ?? []).join(", ")}
        placeholder="Tags, comma separated: lower, unilateral, dumbbell, hinge"
        className={input}
        aria-label="Tags"
      />
      <textarea
        name="cues"
        defaultValue={e?.cues ?? ""}
        placeholder="Coaching cues"
        maxLength={1000}
        rows={3}
        className={`${input} py-2`}
        aria-label="Coaching cues"
      />
    </div>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; cat?: string; sub?: string; hidden?: string; tag?: string; novideo?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { error, q = "", cat = "", sub = "", hidden, tag = "", novideo } = await searchParams;
  const [{ data }, lifts, cats] = await Promise.all([
    allExerciseRows(supabase).then((data) => ({ data })),
    getLifts(supabase),
    loadCategories(supabase),
  ]);
  const all = (data ?? []) as unknown as Exercise[];
  const pool = all.filter((e) => (hidden ? !e.active : e.active));
  const needle = q.trim().toLowerCase();
  const shown = pool.filter(
    (e) =>
      (!cat || e.category === cat) &&
      (!sub || (sub === "none" ? !e.subcategory : e.subcategory === sub)) &&
      (!tag || (e.tags ?? []).includes(tag)) &&
      (!novideo || !e.video_url) &&
      (!needle || e.name.toLowerCase().includes(needle) || (e.tags ?? []).some((t) => t.includes(needle)) || (e.cues ?? "").toLowerCase().includes(needle)),
  );
  const liftOptions = lifts
    .filter((l) => l.kind !== "jump")
    .map((l) => ({ key: l.key, name: l.name }));
  const liftName = new Map(lifts.map((l) => [l.key, l.name]));
  const catLabel = new Map<string, string>(cats.cats);
  const catCount = new Map<string, number>();
  for (const e of pool) catCount.set(e.category, (catCount.get(e.category) ?? 0) + 1);
  const tagCount = new Map<string, number>();
  for (const e of pool) for (const t of e.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 24);
  const noVideo = pool.filter((e) => !e.video_url).length;
  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | undefined> = { q: q || undefined, cat: cat || undefined, sub: sub || undefined, tag: tag || undefined, novideo, hidden, ...over };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const s = p.toString();
    return `/coach/library${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold ${on ? "bg-brand text-white" : "border border-line text-muted hover:text-text"}`;
  const groups = (cat ? [cat] : cats.cats.map(([v]) => v)).map((c) => [c, shown.filter((e) => e.category === c)] as const).filter(([, l]) => l.length);
  const fmtDefault = (e: Exercise) => {
    if (!e.default_sets && !e.default_reps) return null;
    return [e.default_sets && e.default_reps ? `${e.default_sets}×${e.default_reps}` : e.default_reps ?? `${e.default_sets} sets`].join("");
  };

  return (
    <Screen wide>
      <Heading sub={`${all.filter((e) => e.active).length} exercises · ${noVideo} without a video. Archived ones stay on old workouts.`}>
        Exercise library
      </Heading>
      {error && <Alert>{error}</Alert>}

      <div className="mb-4 flex flex-wrap gap-2">
        <form className="flex min-w-64 flex-1 gap-2" role="search">
          {cat && <input type="hidden" name="cat" value={cat} />}
          {tag && <input type="hidden" name="tag" value={tag} />}
          {novideo && <input type="hidden" name="novideo" value="1" />}
          {hidden && <input type="hidden" name="hidden" value="1" />}
          <input name="q" defaultValue={q} placeholder="Search name, tag or cue" className={input} aria-label="Search exercises" />
          <button className={smallBtn}>Search</button>
        </form>
        <details className="relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">+ New exercise</summary>
          <div className="absolute right-0 z-20 mt-2 w-[min(92vw,640px)] rounded-2xl border border-line bg-surface p-4 shadow-2xl">
            <form action={addExercise}>
              <ExerciseFields lifts={liftOptions} cats={cats} />
              <button className="mt-3 min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Add exercise</button>
            </form>
          </div>
        </details>
      </div>

      <p className="mb-2 text-right text-xs"><Link href="/coach/library/categories" className="font-bold text-muted underline underline-offset-4">Edit categories</Link></p>
      {/* Category chips */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Link href={link({ cat: undefined })} className={chip(!cat)}>All <span className="opacity-70">{pool.length}</span></Link>
        {cats.cats.map(([v, l]) => (
          <Link key={v} href={link({ cat: cat === v ? undefined : v, sub: undefined })} className={chip(cat === v)}>
            {l} <span className="opacity-70">{catCount.get(v) ?? 0}</span>
          </Link>
        ))}
      </div>
      {cat && cats.subs[cat] && (
        <div className="mb-2 flex flex-wrap gap-1.5 border-l-2 border-brand pl-2">
          {cats.subs[cat].map(([k, l]) => {
            const n = pool.filter((e) => e.category === cat && e.subcategory === k).length;
            return (
              <Link key={k} href={link({ sub: sub === k ? undefined : k })} className={`${chip(sub === k)} !min-h-8 !text-xs`}>
                {l} <span className="opacity-70">{n}</span>
              </Link>
            );
          })}
          {pool.some((e) => e.category === cat && !e.subcategory) && (
            <Link href={link({ sub: sub === "none" ? undefined : "none" })} className={`${chip(sub === "none")} !min-h-8 !text-xs`}>
              Not sorted <span className="opacity-70">{pool.filter((e) => e.category === cat && !e.subcategory).length}</span>
            </Link>
          )}
        </div>
      )}
      {/* Tag + status filters */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5 text-xs">
        <Link href={link({ novideo: novideo ? undefined : "1" })} className={`${chip(!!novideo)} !min-h-8 !text-xs`}>No video ({noVideo})</Link>
        <Link href={link({ hidden: hidden ? undefined : "1" })} className={`${chip(!!hidden)} !min-h-8 !text-xs`}>Archived</Link>
        {topTags.length > 0 && <span className="ml-2 text-muted">Tags:</span>}
        {topTags.map(([t, n]) => (
          <Link key={t} href={link({ tag: tag === t ? undefined : t })} className={`${chip(tag === t)} !min-h-8 !text-xs`}>
            #{t} <span className="opacity-70">{n}</span>
          </Link>
        ))}
      </div>

      {/* Bulk bar */}
      <form id="bulk" action={bulkExercises} className="sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/95 p-2 backdrop-blur">
        <input type="hidden" name="q" value={q} />
        <span className="px-2 text-xs font-semibold uppercase tracking-widest text-muted">Ticked:</span>
        <select name="op" defaultValue="category" className={`${input} !w-44`} aria-label="Action">
          <option value="category">Move to category</option>
          <option value="tag_add">Add tag</option>
          <option value="tag_remove">Remove tag</option>
          <option value="archive">Archive</option>
          <option value="restore">Restore</option>
        </select>
        <div className="w-56"><PatternSelect name="pattern" cats={cats} value={cat ? `${cat}.${sub && sub !== "none" ? sub : ""}` : "accessory."} /></div>
        <input name="value" list="bulk-values" placeholder="Tag (for tag actions)" className={`${input} !w-44`} aria-label="Tag" />
        <datalist id="bulk-values">
          {topTags.map(([t]) => <option key={t} value={t} />)}
        </datalist>
        <button className={smallBtn}>Apply</button>
        <span className="ml-auto pr-2 text-xs text-muted">{shown.length} shown</span>
      </form>

      {groups.map(([c, list]) => (
        <section key={c} className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            {catLabel.get(c)} · {list.length}
          </h2>
          <div className="grid items-start gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {list.map((e) => (
              <div key={e.id} id={`ex-${e.id}`} className={`scroll-mt-24 rounded-xl border border-line bg-surface ${e.active ? "" : "opacity-60"}`}>
                <div className="flex items-start gap-2 p-3">
                  <input type="checkbox" name="ids" value={e.id} form="bulk" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-brand)]" aria-label={`Select ${e.name}`} />
                  <details className="min-w-0 flex-1">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block font-bold">{e.name}</span>
                        <span className="mt-1 flex flex-wrap gap-1 text-[11px]">
                          {labelOf(cats, e.category, e.subcategory) && <span className="rounded-md bg-brand/10 px-1.5 py-0.5 font-bold text-brand">{labelOf(cats, e.category, e.subcategory)}</span>}
                          {e.video_url ? (
                            <span className="rounded-md bg-ok/15 px-1.5 py-0.5 font-bold text-ok">▶ video</span>
                          ) : (
                            <span className="rounded-md bg-warn/15 px-1.5 py-0.5 font-bold text-warn">no video</span>
                          )}
                          {(e.equipment ?? []).length > 0 && (
                            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-muted">🏋 {(e.equipment ?? []).map(equipmentLabel).join(", ")}</span>
                          )}
                          {e.lift_key && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-muted">% of {liftName.get(e.lift_key) ?? "1RM"}</span>}
                          {fmtDefault(e) && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-muted">default {fmtDefault(e)}</span>}
                          {(e.tags ?? []).map((t) => (
                            <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-muted">#{t}</span>
                          ))}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">Edit</span>
                    </summary>
                    <form action={updateExercise} className="mt-3">
                      <input type="hidden" name="id" value={e.id} />
                      <ExerciseFields e={e} lifts={liftOptions} cats={cats} />
                      <button className={`${smallBtn} mt-3`}>Save</button>
                    </form>
                    <form action={setExerciseActive} className="mt-2">
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="active" value={String(!e.active)} />
                      <button className="text-sm text-muted underline underline-offset-4">{e.active ? "Archive" : "Restore"}</button>
                    </form>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {shown.length === 0 && <p className="text-muted">No exercises match.</p>}
    </Screen>
  );
}
