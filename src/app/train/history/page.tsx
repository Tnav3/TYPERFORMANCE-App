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
  const { data: badges } = await supabase.from("badges").select("key, detail, earned_on").eq("athlete_id", user!.id).order("earned_on", { ascending: false });
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
      {(badges ?? []).length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {(badges ?? []).map((b) => (
            <span key={b.key} className="rounded-full border border-brand/50 bg-brand/10 px-3 py-1 text-xs font-bold" title={b.earned_on}>
              🏅 {b.detail ?? b.key}
            </span>
          ))}
        </div>
      )}
      <ExerciseList rows={rows} exercises={exercises} hrefBase="/train/history" />
    </Screen>
  );
}
