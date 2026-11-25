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
import Link from "next/link";
import { BackLink, Heading, Screen } from "@/components/ui";

const ICON: Record<ToolKey, React.ReactNode> = {
  "1rm": <Dumbbell size={28} strokeWidth={2.25} />,
  mas: <Activity size={28} strokeWidth={2.25} />,
  rpe: <Gauge size={28} strokeWidth={2.25} />,
  hr: <HeartPulse size={28} strokeWidth={2.25} />,
  standards: <Medal size={28} strokeWidth={2.25} />,
  nutrition: <Apple size={28} strokeWidth={2.25} />,
};

export default async function ToolsPage() {
  const { profile } = await requireState(["athlete", "coach"]);
  const tools = toolsFor(profile);
  if (tools.length === 0) redirect("/athlete");
  return (
    <Screen>
      <BackLink href="/more" label="More" />
      <Heading sub="Calculators and charts for your training.">
        Training Tools
      </Heading>
      <div className="grid grid-cols-2 gap-3">
        {tools.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className="flex min-h-32 flex-col justify-between rounded-2xl border border-line bg-surface-2 p-4 transition-colors hover:border-brand"
          >
            <span className="text-brand">{ICON[t.key]}</span>
            <span>
              <span className="block font-extrabold leading-tight">{t.title}</span>
              <span className="mt-1 block text-xs leading-snug text-muted">{t.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </Screen>
  );
}
