import { requireFeature } from "@/lib/session";
import { Tip } from "@/components/Tip";
import { RpeChart } from "@/components/RpeChart";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RpePage() {
  const { state, profile } = await requireFeature(["athlete", "coach"], "rpe");
  return (
    <Screen>
      <BackLink
        href={state === "coach" ? "/" : "/tools"}
        label={state === "coach" ? "Home" : "Training Tools"}
      />
      <Heading sub="How hard a set was, how many reps you had left, and the %1RM it matches.">
        RPE &amp; RIR Chart
      </Heading>
      <Tip profile={profile} tipKey="rpe" />
      <RpeChart />
    </Screen>
  );
}
