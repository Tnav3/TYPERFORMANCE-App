import Link from "next/link";
import { requireState } from "@/lib/session";
import { getLifts } from "@/lib/lift-data";
import {
  EXERCISE_CATEGORIES,
  MEASURES,
  type Exercise,
} from "@/lib/programming/types";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { FIELD_KEYS, FIELD_LABEL } from "@/lib/programming/fields";
import { addExercise, setExerciseActive, updateExercise } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

function ExerciseFields({
  e,
  lifts,
}: {
  e?: Exercise;
  lifts: { key: string; name: string }[];
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
        <select
          name="category"
          defaultValue={e?.category ?? "accessory"}
          className={input}
          aria-label="Category"
        >
          {EXERCISE_CATEGORIES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
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
            <select name="speed_unit" defaultValue={e?.speed_unit ?? "kmh"} className={input}>
              <option value="kmh">km/h</option><option value="mph">mph</option>
            </select>
          </label>
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
  searchParams: Promise<{ error?: string; q?: string; cat?: string; hidden?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { error, q = "", cat = "", hidden } = await searchParams;
  const [{ data }, lifts] = await Promise.all([
    supabase.from("exercises").select("*").order("name"),
    getLifts(supabase),
  ]);
  const all = (data ?? []) as Exercise[];
  const needle = q.trim().toLowerCase();
  const shown = all.filter(
    (e) =>
      (hidden ? true : e.active) &&
      (!cat || e.category === cat) &&
      (!needle || e.name.toLowerCase().includes(needle)),
  );
  const liftOptions = lifts
    .filter((l) => l.kind !== "jump")
    .map((l) => ({ key: l.key, name: l.name }));
  const liftName = new Map(lifts.map((l) => [l.key, l.name]));
  const catLabel = new Map<string, string>(EXERCISE_CATEGORIES);

  return (
    <Screen wide>
      <BackLink href="/coach" label="Dashboard" />
      <Heading sub={`${all.filter((e) => e.active).length} exercises. Archived ones stay on old workouts.`}>
        Exercise library
      </Heading>
      {error && <Alert>{error}</Alert>}

      <form className="mb-4 flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search"
          className={input}
          aria-label="Search exercises"
        />
        <select name="cat" defaultValue={cat} className={`${input} !w-40`} aria-label="Category">
          <option value="">All</option>
          {EXERCISE_CATEGORIES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button className={smallBtn}>Go</button>
      </form>
      <p className="mb-4 text-sm">
        <Link
          href={`/coach/library?${new URLSearchParams({ q, cat, ...(hidden ? {} : { hidden: "1" }) })}`}
          className="text-muted underline underline-offset-4"
        >
          {hidden ? "Hide archived" : "Show archived"}
        </Link>
      </p>

      <details className="mb-6 rounded-2xl border border-brand/50 bg-surface p-4">
        <summary className="cursor-pointer font-extrabold">+ Add an exercise</summary>
        <form action={addExercise} className="mt-4">
          <ExerciseFields lifts={liftOptions} />
          <button className="mt-3 min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">
            Add exercise
          </button>
        </form>
      </details>

      <div className="space-y-2">
        {shown.map((e) => (
          <Card key={e.id} className={`!p-3 scroll-mt-6 ${e.active ? "" : "opacity-60"}`}>
            <details id={`ex-${e.id}`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block font-bold">{e.name}</span>
                  <span className="block text-xs text-muted">
                    {catLabel.get(e.category)}
                    {e.lift_key && ` · % of ${liftName.get(e.lift_key) ?? "1RM"}`}
                    {e.video_url && " · video"}
                    {!e.active && " · archived"}
                  </span>
                </span>
                <span className="text-sm text-muted">Edit</span>
              </summary>
              <form action={updateExercise} className="mt-3">
                <input type="hidden" name="id" value={e.id} />
                <ExerciseFields e={e} lifts={liftOptions} />
                <button className={`${smallBtn} mt-3`}>Save</button>
              </form>
              <form action={setExerciseActive} className="mt-2">
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="active" value={String(!e.active)} />
                <button className="text-sm text-muted underline underline-offset-4">
                  {e.active ? "Archive" : "Restore"}
                </button>
              </form>
            </details>
          </Card>
        ))}
        {shown.length === 0 && <p className="text-muted">No exercises match.</p>}
      </div>
    </Screen>
  );
}
