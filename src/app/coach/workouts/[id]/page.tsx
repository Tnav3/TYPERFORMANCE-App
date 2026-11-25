import { allExercises } from "@/lib/programming/all-exercises";
import { ClientContext } from "@/components/ClientContext";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { ITEM_COLUMNS, type ItemFields, type Workout } from "@/lib/programming/types";
import { ItemsEditor } from "@/components/ItemsEditor";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { deleteWorkout, personaliseWorkout, updateWorkout } from "../actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

export default async function CoachWorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const { error } = await searchParams;
  const [{ data: w }, { data: items }, { data: exercises }, { data: logs }] = await Promise.all([
    supabase.from("workouts").select("*").eq("id", id).maybeSingle<Workout>(),
    supabase.from("workout_items").select(ITEM_COLUMNS).eq("workout_id", id).order("position"),
    allExercises(supabase).then((data) => ({ data })),
    supabase
      .from("workout_logs")
      .select("id, athlete_id, completed_at, session_rpe, profiles(full_name, email)")
      .eq("workout_id", id),
  ]);
  if (!w) notFound();

  const [{ data: owner }, { data: members }, { data: overrides }] = await Promise.all([
    w.athlete_id
      ? supabase.from("profiles").select("full_name, email").eq("id", w.athlete_id).maybeSingle()
      : supabase.from("groups").select("name").eq("id", w.group_id!).maybeSingle(),
    w.group_id
      ? supabase.from("group_members").select("athlete_id, profiles(full_name, email)").eq("group_id", w.group_id)
      : Promise.resolve({ data: [] }),
    w.group_id
      ? supabase.from("workouts").select("id, athlete_id").eq("overrides_id", w.id)
      : Promise.resolve({ data: [] }),
  ]);
  const ownerName =
    (owner as { full_name?: string | null; email?: string; name?: string } | null)?.full_name ??
    (owner as { email?: string } | null)?.email ??
    (owner as { name?: string } | null)?.name ??
    "";
  const backHref = w.athlete_id
    ? `/coach/athlete/${w.athlete_id}/program?from=${w.workout_date}`
    : `/coach/groups/${w.group_id}?from=${w.workout_date}`;
  const overrideBy = new Map(((overrides ?? []) as { id: string; athlete_id: string }[]).map((o) => [o.athlete_id, o.id]));
  const memberRows = (members ?? []) as unknown as {
    athlete_id: string;
    profiles: { full_name: string | null; email: string };
  }[];
  const logRows = (logs ?? []) as unknown as {
    id: string;
    athlete_id: string;
    completed_at: string | null;
    session_rpe: number | null;
    profiles: { full_name: string | null; email: string };
  }[];

  return (
    <Screen wide>
      <BackLink href={backHref} label={ownerName || "Calendar"} />
      <Heading sub={`${formatDate(w.workout_date)}${w.group_id ? " · group workout" : ""}${w.overrides_id ? " · personalised copy" : ""}`}>
        {w.title}
      </Heading>
      {w.athlete_id && <ClientContext athleteId={w.athlete_id} />}
      {error && <Alert>{error}</Alert>}
      {w.overrides_id && (
        <Alert tone="info">
          This is a personal version of a group workout. Changes here only affect {ownerName}.{" "}
          <Link href={`/coach/workouts/${w.overrides_id}`} className="underline underline-offset-4">
            Open the group version
          </Link>
        </Alert>
      )}

      {logRows.length > 0 && (
        <Card className="mb-4 !p-4">
          <h2 className="mb-2 font-extrabold">Logged</h2>
          <ul className="space-y-1 text-sm">
            {logRows.map((l) => (
              <li key={l.id}>
                <Link href={`/coach/logs/${l.id}`} className="underline underline-offset-4">
                  {l.profiles.full_name ?? l.profiles.email}
                </Link>{" "}
                <span className="text-muted">
                  {l.completed_at ? `done · RPE ${l.session_rpe}` : "started"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <details className="mb-4 rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-bold">Title, date and notes</summary>
        <form action={updateWorkout} className="mt-3 space-y-2">
          <input type="hidden" name="id" value={w.id} />
          <input name="title" defaultValue={w.title} maxLength={80} required className={input} aria-label="Title" />
          <input name="date" type="date" defaultValue={w.workout_date} required className={input} aria-label="Date" />
          <textarea name="notes" defaultValue={w.notes ?? ""} rows={3} maxLength={2000} placeholder="Notes shown at the top of the workout" className={`${input} py-2`} aria-label="Notes" />
          <button className={smallBtn}>Save</button>
        </form>
      </details>

      <ItemsEditor
        table="workout_items"
        parentId={w.id}
        back={`/coach/workouts/${w.id}`}
        items={(items ?? []) as unknown as ItemFields[]}
        exercises={exercises ?? []}
      />

      {w.group_id && memberRows.length > 0 && (
        <Card className="mt-6 !p-4">
          <h2 className="mb-1 font-extrabold">Personalise for one member</h2>
          <p className="mb-3 text-sm text-muted">
            Makes a personal copy that replaces this workout for that person only.
          </p>
          <ul className="space-y-2">
            {memberRows.map((m) => {
              const existing = overrideBy.get(m.athlete_id);
              const who = m.profiles.full_name ?? m.profiles.email;
              return (
                <li key={m.athlete_id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{who}</span>
                  {existing ? (
                    <Link href={`/coach/workouts/${existing}`} className="font-bold text-brand">
                      Edit their version →
                    </Link>
                  ) : (
                    <form action={personaliseWorkout}>
                      <input type="hidden" name="id" value={w.id} />
                      <input type="hidden" name="athlete_id" value={m.athlete_id} />
                      <button className={smallBtn}>Personalise</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <form action={deleteWorkout} className="mt-8">
        <input type="hidden" name="id" value={w.id} />
        <input type="hidden" name="back" value={backHref} />
        <button className={`${smallBtn} !border-brand/60 !text-brand`}>Delete workout</button>
        {logRows.length > 0 && (
          <span className="ml-3 text-xs text-muted">Deleting also deletes what was logged.</span>
        )}
      </form>
    </Screen>
  );
}
