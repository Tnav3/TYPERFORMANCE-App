import { ClientTabs } from "@/components/ClientTabs";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { getRomEntries, getRomMeasures } from "@/lib/mobility-data";
import { RomForm } from "@/components/RomForm";
import { RomHistory, RomSummary } from "@/components/RomSummary";
import { Card, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CoachAthleteMobility({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const [{ data: p }, measures, entries] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", id)
      .maybeSingle(),
    getRomMeasures(supabase),
    getRomEntries(supabase, id),
  ]);
  if (!p) notFound();
  const back = `/coach/athlete/${id}/mobility`;

  return (
    <Screen wide>
      <ClientTabs id={id} name={p.full_name ?? p.email} active="mobility" />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
      <RomSummary measures={measures} entries={entries} showUntested />
      <RomHistory
        measures={measures}
        entries={entries}
        back={back}
        canDelete={() => true}
      />
      </div>

      <Card className="mb-6 lg:sticky lg:top-4">
        <h2 className="mb-1 text-lg font-black uppercase">Enter a screen</h2>
        <p className="mb-4 text-sm text-muted">
          Degrees unless marked cm. Thomas thigh angle: degrees below horizontal
          (negative if above).
        </p>
        <RomForm
          measures={measures}
          athleteId={id}
          scope="all"
          today={todayISO()}
        />
      </Card>
      </div>
    </Screen>
  );
}
