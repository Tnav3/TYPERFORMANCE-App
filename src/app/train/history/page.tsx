import Link from "next/link";
import { requireFeature } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { clientMenu } from "@/lib/client/menu";
import { ClientTabBar } from "@/components/ClientTabBar";
import { hasFeature } from "@/lib/features";
import { loggedSets } from "@/lib/programming/history-data";
import type { Exercise } from "@/lib/programming/types";
import { ExerciseList } from "@/components/ProgressViews";
import { Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { supabase, user, profile } = await requireFeature(["athlete"], "program");
  const menu = await clientMenu(supabase, profile, user!.id, todayISO());
  const rows = await loggedSets(supabase, user!.id);
  const ids = [...new Set(rows.map((r) => r.key))];
  const { data } = ids.length
    ? await supabase.from("exercises").select("id, name, measure").in("id", ids)
    : { data: [] };
  const { data: badges } = await supabase.from("badges").select("key, detail, earned_on").eq("athlete_id", user!.id).order("earned_on", { ascending: false });
  const exercises = new Map(((data ?? []) as Exercise[]).map((e) => [e.id, e]));
  return (
    <Screen>
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
        <Link href="/trophies" className="mb-5 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <span className="text-xl" aria-hidden>🏅</span>
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold">{(badges ?? []).length} badge{(badges ?? []).length === 1 ? "" : "s"} earned</span>
            <span className="block truncate text-xs text-muted">Latest: {(badges ?? [])[0].detail ?? (badges ?? [])[0].key}</span>
          </span>
          <span className="text-sm font-bold text-brand">Trophy cabinet →</span>
        </Link>
      )}
      <ExerciseList rows={rows} exercises={exercises} hrefBase="/train/history" />
      <ClientTabBar train chat={menu.chatOn} progress chatBadge={menu.unreadChat} moreBadge={menu.formsDue} food={menu.food} />
    </Screen>
  );
}
