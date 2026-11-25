import { DeleteOwnWorkout } from "@/components/DeleteOwnWorkout";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireFeature } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { loadLoggerData } from "@/lib/programming/logger-data";
import { ReadinessCheck } from "@/components/ReadinessCheck";
import { readinessAdvice, readinessTone } from "@/lib/programming/rewards";
import { WorkoutLogger } from "@/components/WorkoutLogger";
import { loadGlossary } from "@/lib/glossary-data";
import { tipSeen } from "@/lib/tutorial";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WorkoutLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase, user, state, viewAs, profile } = await requireFeature(["athlete", "coach"], "program");
  const { id } = await params;
  if (state === "coach") redirect(`/coach/workouts/${id}`);
  const [d, glossary] = await Promise.all([loadLoggerData(supabase, id, user!.id), loadGlossary(supabase)]);
  if (!d) notFound();
  const { workout, assignment, ready, log, items, blocks, locked, early, finished, today, lastRpe, equipment } = d;

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
      {!ready && !finished && !locked && !viewAs && workout.workout_date === today && items.length > 0 && <ReadinessCheck />}
      {ready && !finished && (
        <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${readinessTone(ready.score) === "ok" ? "border-ok/50" : readinessTone(ready.score) === "warn" ? "border-warn/50" : "border-brand/50"}`}>
          <span className="font-black">Readiness {ready.score}</span> · {readinessAdvice(ready.score)}
        </p>
      )}
      {!finished && items.length > 0 && (
        <div className="mb-4 rounded-xl border border-line bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">You&apos;ll need</p>
          {equipment.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {equipment.map((e) => (
                <li key={e.key} className="rounded-full bg-surface-2 px-3 py-1 text-sm font-bold">{e.label}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm font-bold">No equipment. Just you.</p>
          )}
        </div>
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
        athleteId={viewAs ? user!.id : undefined}
        glossary={glossary}
        guide={!viewAs && profile.role === "athlete" && !tipSeen(profile, "logger")}
      />
      {workout.created_by === user!.id && !viewAs && (
        <div className="mt-6 text-center">
          <DeleteOwnWorkout id={workout.id} />
        </div>
      )}
    </Screen>
  );
}
