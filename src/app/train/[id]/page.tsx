import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireFeature } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { loadLoggerData } from "@/lib/programming/logger-data";
import { ReadinessCheck } from "@/components/ReadinessCheck";
import { readinessAdvice, readinessTone } from "@/lib/programming/rewards";
import { WorkoutLogger } from "@/components/WorkoutLogger";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WorkoutLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase, user, state } = await requireFeature(["athlete", "coach"], "program");
  const { id } = await params;
  if (state === "coach") redirect(`/coach/workouts/${id}`);
  const d = await loadLoggerData(supabase, id, user!.id);
  if (!d) notFound();
  const { workout, assignment, ready, log, items, blocks, locked, early, finished, today, lastRpe } = d;

  return (
    <Screen>
      <BackLink href="/train" label="Training" />
      <Heading sub={formatDate(workout.workout_date)}>{workout.title}</Heading>
      {locked && <Alert tone="info">This week is locked (older than 4 weeks), so it&apos;s view only.</Alert>}
      {early && <Alert tone="info">This is for {formatDate(workout.workout_date)}. You can log it from the day before.</Alert>}
      {assignment?.instructions && (
        <details className="mb-3 rounded-xl border border-line bg-surface p-3 text-sm">
          <summary className="cursor-pointer font-bold">{assignment.program_name}: instructions</summary>
          <p className="mt-2 whitespace-pre-line">{assignment.instructions}</p>
        </details>
      )}
      {workout.notes && <p className="mb-4 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{workout.notes}</p>}
      {!ready && !finished && !locked && workout.workout_date === today && items.length > 0 && <ReadinessCheck />}
      {ready && !finished && (
        <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${readinessTone(ready.score) === "ok" ? "border-ok/50" : readinessTone(ready.score) === "warn" ? "border-warn/50" : "border-brand/50"}`}>
          <span className="font-black">Readiness {ready.score}</span> · {readinessAdvice(ready.score)}
        </p>
      )}
      {finished && (
        <Link href={`/train/${workout.id}/summary`} className="mb-4 block rounded-xl border border-ok/50 bg-ok/10 px-3 py-2 text-sm font-bold">
          Session summary →
        </Link>
      )}
      {items.length === 0 && <p className="text-muted">Nothing prescribed for this day.</p>}
      <WorkoutLogger
        workoutId={workout.id}
        blocks={blocks}
        comment={log?.comment ?? ""}
        finished={finished}
        rpe={log?.session_rpe ?? null}
        lastRpe={lastRpe}
        duration={log?.duration_min ?? null}
        readOnly={locked || early}
      />
    </Screen>
  );
}
