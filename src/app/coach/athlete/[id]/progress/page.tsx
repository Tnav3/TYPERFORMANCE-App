import { ClientTabs } from "@/components/ClientTabs";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { bodyweights, loggedSets } from "@/lib/programming/history-data";
import type { Exercise } from "@/lib/programming/types";
import { BodyweightTrend, ExerciseList } from "@/components/ProgressViews";
import { Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CoachProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const { data: client } = await supabase
    .from("profiles")
    .select("full_name, email, weight_class_limit_kg")
    .eq("id", id)
    .maybeSingle();
  if (!client) notFound();
  const [rows, weights] = await Promise.all([loggedSets(supabase, id), bodyweights(supabase, id)]);
  const ids = [...new Set(rows.map((r) => r.key))];
  const { data } = ids.length
    ? await supabase.from("exercises").select("id, name, measure, category").in("id", ids)
    : { data: [] };
  const exercises = new Map(((data ?? []) as Exercise[]).map((e) => [e.id, e]));
  const name = client.full_name ?? client.email;

  return (
    <Screen wide>
      <ClientTabs id={id} name={name} active="progress" />
      {weights.length > 0 && (
        <div className="mb-6">
          <BodyweightTrend
            rows={weights}
            limit={client.weight_class_limit_kg != null ? Number(client.weight_class_limit_kg) : null}
          />
        </div>
      )}
      <ExerciseList rows={rows} exercises={exercises} hrefBase={`/coach/athlete/${id}/progress`} />
    </Screen>
  );
}
