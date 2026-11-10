import { requireFeature } from "@/lib/session";
import { Tip } from "@/components/Tip";
import { HrZones } from "@/components/HrZones";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HrPage() {
  const { state, profile } = await requireFeature(["athlete", "coach"], "hr");
  return (
    <Screen>
      <BackLink
        href={state === "coach" ? "/" : "/tools"}
        label={state === "coach" ? "Home" : "Training Tools"}
      />
      <Heading sub="Your heart-rate zones in beats per minute, with the effort (RPE) each one should feel like.">
        HR Zones
      </Heading>
      <Tip profile={profile} tipKey="hr" />
      <HrZones />
    </Screen>
  );
}
