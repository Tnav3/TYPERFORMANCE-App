import { redirect } from "next/navigation";
import {
  Activity,
  Apple,
  Dumbbell,
  Gauge,
  HeartPulse,
  Medal,
} from "lucide-react";
import { requireState } from "@/lib/session";
import { toolsFor, type ToolKey } from "@/lib/tools";
import { BackLink, FeatureLink, Heading, Screen } from "@/components/ui";

const ICON: Record<ToolKey, React.ReactNode> = {
  "1rm": <Dumbbell size={22} strokeWidth={2.25} />,
  mas: <Activity size={22} strokeWidth={2.25} />,
  rpe: <Gauge size={22} strokeWidth={2.25} />,
  hr: <HeartPulse size={22} strokeWidth={2.25} />,
  standards: <Medal size={22} strokeWidth={2.25} />,
  nutrition: <Apple size={22} strokeWidth={2.25} />,
};

export default async function ToolsPage() {
  const { profile } = await requireState(["athlete", "coach"]);
  const tools = toolsFor(profile);
  if (tools.length === 0) redirect("/athlete");
  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading sub="Calculators and charts for your training.">
        Training Tools
      </Heading>
      {tools.map((t) => (
        <FeatureLink
          key={t.key}
          href={t.href}
          title={t.title}
          description={t.description}
          icon={ICON[t.key]}
        />
      ))}
    </Screen>
  );
}
