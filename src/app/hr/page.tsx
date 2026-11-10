import { requireFeature } from "@/lib/session";
import { HrZones } from "@/components/HrZones";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HrPage() {
  const { state } = await requireFeature(["athlete", "coach"], "hr");
  return (
    <Screen>
      <BackLink
        href={state === "coach" ? "/" : "/tools"}
        label={state === "coach" ? "Home" : "Training Tools"}
      />
      <Heading sub="Your heart-rate zones in beats per minute, with the effort (RPE) each one should feel like.">
        HR Zones
      </Heading>
      <HrZones />
    </Screen>
  );
}
