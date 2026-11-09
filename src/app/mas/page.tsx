import { requireState } from "@/lib/session";
import { MasCalculator } from "@/components/MasCalculator";
import { MAS_MODES, MAS_MODE_ORDER, masModeOf, type MasMode } from "@/lib/testing";
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

  const saved = Object.fromEntries(MAS_MODE_ORDER.map((m) => [m, null])) as Record<MasMode, number | null>;
  if (isAthlete) {
    const { data } = await supabase
      .from("test_entries")
      .select("test_key, values, tested_on, created_at")
      .eq("athlete_id", user!.id)
      .in("test_key", MAS_MODE_ORDER.map((m) => MAS_MODES[m].testKey));
    const newestFirst = [...(data ?? [])].sort((a, b) =>
      a.tested_on === b.tested_on
        ? b.created_at.localeCompare(a.created_at)
        : b.tested_on.localeCompare(a.tested_on),
    );
    for (const e of newestFirst) {
      const m = masModeOf(e.test_key);
      const d = m ? (e.values as Record<string, number>)[MAS_MODES[m].field] : undefined;
      if (m && saved[m] == null && d) saved[m] = d;
    }
  }
  const mode: MasMode =
    test && (MAS_MODE_ORDER as string[]).includes(test)
      ? (test as MasMode)
      : (MAS_MODE_ORDER.find((m) => saved[m] != null) ?? "run");

  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading sub="Enter your 5-minute test distance to get your MAS and the distance for any rep up to 5 minutes.">
        MAS Calculator
      </Heading>
      <MasCalculator initialMode={mode} saved={saved} canSave={isAthlete} />
    </Screen>
  );
}
