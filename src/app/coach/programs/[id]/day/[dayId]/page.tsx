import { allExercises } from "@/lib/programming/all-exercises";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { ITEM_COLUMNS, type ItemFields, type ProgramDay } from "@/lib/programming/types";
import { ItemsEditor } from "@/components/ItemsEditor";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";
import { clearDay, copyDay, updateDay } from "../../../actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

export default async function ProgramDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; dayId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id, dayId } = await params;
  const { error } = await searchParams;
  const [{ data: day }, { data: program }, { data: items }, { data: exercises }, { data: siblings }] =
    await Promise.all([
      supabase.from("program_days").select("*").eq("id", dayId).eq("program_id", id).maybeSingle<ProgramDay>(),
      supabase.from("programs").select("id, name, weeks").eq("id", id).maybeSingle(),
      supabase.from("program_items").select(ITEM_COLUMNS).eq("day_id", dayId).order("position"),
      allExercises(supabase).then((data) => ({ data })),
      supabase.from("program_days").select("id, week_no, day_no").eq("program_id", id).order("week_no").order("day_no"),
    ]);
  if (!day || !program) notFound();
  const back = `/coach/programs/${id}/day/${dayId}`;

  // Previous / next day that has content, for quick hopping
  const list = siblings ?? [];
  const idx = list.findIndex((s) => s.id === dayId);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  return (
    <Screen wide>
      <BackLink href={`/coach/programs/${id}#week-${day.week_no}`} label={program.name} />
      <Heading sub={`Week ${day.week_no} · Day ${day.day_no}`}>{day.title || "Training day"}</Heading>
      {error && <Alert>{error}</Alert>}

      <div className="mb-4 flex justify-between text-sm">
        {prev ? (
          <Link href={`/coach/programs/${id}/day/${prev.id}`} className="text-muted underline underline-offset-4">
            ‹ W{prev.week_no}D{prev.day_no}
          </Link>
        ) : <span />}
        {next && (
          <Link href={`/coach/programs/${id}/day/${next.id}`} className="text-muted underline underline-offset-4">
            W{next.week_no}D{next.day_no} ›
          </Link>
        )}
      </div>

      <details className="mb-4 rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-bold">Day title and notes</summary>
        <form action={updateDay} className="mt-3 space-y-2">
          <input type="hidden" name="id" value={day.id} />
          <input type="hidden" name="back" value={back} />
          <input name="title" defaultValue={day.title ?? ""} placeholder="e.g. Lower: max strength" maxLength={80} className={input} aria-label="Title" />
          <textarea name="notes" defaultValue={day.notes ?? ""} rows={3} maxLength={2000} placeholder="Notes the client sees at the top of the workout" className={`${input} py-2`} aria-label="Notes" />
          <button className={smallBtn}>Save</button>
        </form>
      </details>

      <ItemsEditor
        table="program_items"
        parentId={day.id}
        back={back}
        items={(items ?? []) as unknown as ItemFields[]}
        exercises={exercises ?? []}
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <form action={copyDay} className="rounded-2xl border border-line bg-surface p-4">
          <input type="hidden" name="id" value={day.id} />
          <input type="hidden" name="program_id" value={id} />
          <input type="hidden" name="back" value={back} />
          <p className="mb-2 font-bold">Copy this day to</p>
          <div className="flex gap-2">
            <select name="to_week" defaultValue={Math.min(program.weeks, day.week_no + 1)} className={input} aria-label="Week">
              {Array.from({ length: program.weeks }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
            <select name="to_day" defaultValue={day.day_no} className={input} aria-label="Day">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>Day {d}</option>
              ))}
            </select>
            <button className={smallBtn}>Copy</button>
          </div>
          <p className="mt-1 text-xs text-muted">Replaces whatever is on that day.</p>
        </form>
        <form action={clearDay} className="rounded-2xl border border-line bg-surface p-4">
          <input type="hidden" name="id" value={day.id} />
          <input type="hidden" name="program_id" value={id} />
          <p className="mb-2 font-bold">Make this a rest day</p>
          <button className={`${smallBtn} !border-brand/60 !text-brand`}>Clear day</button>
        </form>
      </div>
    </Screen>
  );
}
