import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { loggedSets } from "@/lib/programming/history-data";
import type { Exercise } from "@/lib/programming/types";
import { ExerciseHistory } from "@/components/ProgressViews";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CoachExerciseHistory({
  params,
}: {
  params: Promise<{ id: string; exerciseId: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id, exerciseId } = await params;
  const [{ data: ex }, { data: client }, sets] = await Promise.all([
    supabase.from("exercises").select("*").eq("id", exerciseId).maybeSingle<Exercise>(),
    supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle(),
    loggedSets(supabase, id, exerciseId),
  ]);
  if (!ex || !client) notFound();
  return (
    <Screen wide>
      <BackLink href={`/coach/athlete/${id}/progress`} label="Progress" />
      <Heading sub={client.full_name ?? client.email}>{ex.name}</Heading>
      <ExerciseHistory sets={sets} measure={ex.measure} />
    </Screen>
  );
}
