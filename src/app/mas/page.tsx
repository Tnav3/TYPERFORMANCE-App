import { requireState } from "@/lib/session";
import { MasCalculator, type MasMode } from "@/components/MasCalculator";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MasPage({
  searchParams,
}: {
  searchParams: Promise<{ test?: string }>;
}) {
  const { supabase, user, state } = await requireState(["athlete", "coach"]);
  const { test } = await searchParams;
  const isAthlete = state === "athlete";

  const saved: { run: number | null; bike: number | null } = { run: null, bike: null };
  if (isAthlete) {
    const { data } = await supabase
      .from("test_entries")
      .select("test_key, values, tested_on, created_at")
      .eq("athlete_id", user!.id)
      .in("test_key", ["mas_5min", "mas_bike_5min"])
      .order("tested_on", { ascending: false })
      .order("created_at", { ascending: false });
    const newestFirst = [...(data ?? [])].sort((a, b) =>
      a.tested_on === b.tested_on
        ? b.created_at.localeCompare(a.created_at)
        : b.tested_on.localeCompare(a.tested_on),
    );
    for (const e of newestFirst) {
      const v = e.values as Record<string, number>;
      if (e.test_key === "mas_5min" && saved.run == null && v.distance_m) saved.run = v.distance_m;
      if (e.test_key === "mas_bike_5min" && saved.bike == null && v.distance_km) saved.bike = v.distance_km;
    }
  }
  const mode: MasMode =
    test === "bike" || test === "run" ? test : saved.run == null && saved.bike != null ? "bike" : "run";

  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading sub="Enter your 5-minute test distance to get your MAS and the distance for each rep.">
        MAS calculator
      </Heading>
      <MasCalculator initialMode={mode} saved={saved} canSave={isAthlete} />
    </Screen>
  );
}
