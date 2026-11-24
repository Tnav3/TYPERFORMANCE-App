import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/session";
import { loggedSets } from "@/lib/programming/history-data";
import { sessions } from "@/lib/programming/history";
import type { Exercise } from "@/lib/programming/types";
import { ExerciseHistory } from "@/components/ProgressViews";
import { ExerciseVideo } from "@/components/ExerciseVideo";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";
import { saveSetAsMax } from "../../progress-actions";

export const dynamic = "force-dynamic";

export default async function ExerciseHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ exerciseId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { supabase, user } = await requireFeature(["athlete"], "program");
  const { exerciseId } = await params;
  const sp = await searchParams;
  const { data: ex } = await supabase
    .from("exercises")
    .select("*, lifts(kind)")
    .eq("id", exerciseId)
    .maybeSingle<Exercise & { lifts: { kind: string } | null }>();
  if (!ex) notFound();
  const sets = await loggedSets(supabase, user!.id, exerciseId);
  const best = sessions(sets)
    .filter((s) => s.topSet && s.topSet.reps <= 10)
    .sort((a, b) => (b.bestE1rm ?? 0) - (a.bestE1rm ?? 0))[0];
  const canSave = ex.lift_key && ex.lifts && ex.lifts.kind !== "jump" && best?.topSet;

  return (
    <Screen>
      <BackLink href="/train/history" label="My progress" />
      <Heading>{ex.name}</Heading>
      {sp.error && <Alert>{sp.error}</Alert>}
      {sp.saved && <Alert tone="ok">Saved to your 1RMs. Future % loads use it.</Alert>}
      <ExerciseVideo url={ex.video_url} name={ex.name} />
      <ExerciseHistory
        sets={sets}
        measure={ex.measure}
        saveSlot={
          canSave ? (
            <form action={saveSetAsMax} className="mt-3">
              <input type="hidden" name="exercise_id" value={ex.id} />
              <input type="hidden" name="kg" value={best!.topSet!.kg} />
              <input type="hidden" name="reps" value={best!.topSet!.reps} />
              <button className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold">
                Use best set ({best!.topSet!.reps} × {best!.topSet!.kg} kg) as my 1RM
              </button>
            </form>
          ) : null
        }
      />
    </Screen>
  );
}
