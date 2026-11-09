import { requireFeature } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import type { Fight } from "@/lib/fights";
import { FightForm } from "@/components/FightForm";
import { FightRecordView } from "@/components/FightRecordView";
import { BackLink, Card, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FightsPage() {
  const { supabase, user, profile } = await requireFeature(
    ["athlete"],
    "fights",
  );
  const today = todayISO();
  const { data } = await supabase
    .from("fights")
    .select("id, athlete_id, fought_on, result, rounds, created_at")
    .eq("athlete_id", user!.id);
  const planned = profile.next_fight_date;
  const defaultDate = planned && planned <= today ? planned : today;

  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading sub="Log each fight's result and how many rounds it went.">
        Fight Record
      </Heading>
      <FightRecordView
        fights={(data ?? []) as Fight[]}
        back="/fights"
        thisYear={Number(today.slice(0, 4))}
      />
      <div id="log" className="scroll-mt-6" />
      <Card className="mt-6">
        <h2 className="mb-4 text-lg font-black uppercase">Log a fight</h2>
        <FightForm defaultDate={defaultDate} today={today} />
      </Card>
    </Screen>
  );
}
