import { requireFeature } from "@/lib/session";
import { Tip } from "@/components/Tip";
import { todayISO } from "@/lib/dates";
import { getRomEntries, getRomMeasures } from "@/lib/mobility-data";
import { RomForm } from "@/components/RomForm";
import { RomHistory, RomSummary } from "@/components/RomSummary";
import { BackLink, Card, Heading, Screen } from "@/components/ui";

// Self-tests are hidden while they're being reworked; flip to true to bring them back.
const SELF_TESTS_ON = false;

export default async function MobilityPage() {
  const { supabase, user, state, profile } = await requireFeature(
    ["athlete", "coach"],
    "mobility",
  );
  const [measures, entries] = await Promise.all([
    getRomMeasures(supabase),
    getRomEntries(supabase, user!.id),
  ]);
  const selfTests = measures.filter((m) => m.self_test);

  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading>Mobility</Heading>
      <Tip profile={profile} tipKey="mobility" />
      <Card className="mb-6">
        <p className="text-[15px] leading-relaxed">
          How well your joints move compared with healthy, athletic norms.
          <b className="text-ok"> Within norm</b> means you have the range you
          need; <b className="text-warn">below norm</b> or a big gap between
          left and right is worth working on.
        </p>
        <p className="mt-2 text-sm text-muted">
          {SELF_TESTS_ON
            ? "Your coach measures most of these. You can do the self-tests below at home and track them yourself."
            : "Your coach measures these during your screening."}
        </p>
      </Card>

      <RomSummary measures={measures} entries={entries} />

      {SELF_TESTS_ON && state !== "coach" && selfTests.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-1 text-lg font-black uppercase">Self-tests</h2>
          <p className="mb-4 text-sm text-muted">
            Same time of day, warmed up the same way, so results compare.
          </p>
          <RomForm measures={selfTests} scope="self" today={todayISO()} />
        </Card>
      )}

      <RomHistory
        measures={measures}
        entries={entries}
        back="/mobility"
        canDelete={(e) => e.entered_by === user!.id}
      />
    </Screen>
  );
}
