import { requireFeature } from "@/lib/session";
import { RpeChart } from "@/components/RpeChart";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RpePage() {
  const { state } = await requireFeature(["athlete", "coach"], "rpe");
  return (
    <Screen>
      <BackLink
        href={state === "coach" ? "/" : "/tools"}
        label={state === "coach" ? "Home" : "Training Tools"}
      />
      <Heading sub="How hard a set was, how many reps you had left, and the %1RM it matches.">
        RPE &amp; RIR Chart
      </Heading>
      <RpeChart />
    </Screen>
  );
}
