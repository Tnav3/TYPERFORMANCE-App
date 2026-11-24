import Link from "next/link";
import { requireFeature } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { loggedSets } from "@/lib/programming/history-data";
import type { Exercise } from "@/lib/programming/types";
import { ExerciseList } from "@/components/ProgressViews";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { supabase, user, profile } = await requireFeature(["athlete"], "program");
  const rows = await loggedSets(supabase, user!.id);
  const ids = [...new Set(rows.map((r) => r.key))];
  const { data } = ids.length
    ? await supabase.from("exercises").select("id, name, measure").in("id", ids)
    : { data: [] };
  const exercises = new Map(((data ?? []) as Exercise[]).map((e) => [e.id, e]));
  return (
    <Screen>
      <BackLink href="/train" label="Training" />
      <Heading sub="Tap an exercise for your trend and personal bests.">My progress</Heading>
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        {hasFeature(profile, "bodyweight") && (
          <Link href="/bodyweight" className="font-bold text-brand">Bodyweight →</Link>
        )}
        {hasFeature(profile, "leaderboard") && (
          <Link href="/train/leaderboard" className="font-bold text-brand">Leaderboards →</Link>
        )}
      </div>
      <ExerciseList rows={rows} exercises={exercises} hrefBase="/train/history" />
    </Screen>
  );
}
