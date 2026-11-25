import { requireFeature } from "@/lib/session";
import { Tip } from "@/components/Tip";
import { todayISO } from "@/lib/dates";
import type { Fight } from "@/lib/fights";
import { FightForm } from "@/components/FightForm";
import { FightRecordView } from "@/components/FightRecordView";
import { TitlesEditor } from "@/components/TitlesEditor";
import { FightLevelPicker } from "@/components/FightLevelPicker";
import type { Title } from "@/lib/titles";
import { BackLink, Card, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FightsPage({ searchParams }: { searchParams: Promise<{ title_error?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, profile, viewAs } = await requireFeature(
    ["athlete"],
    "fights",
  );
  const today = todayISO();
  const { data } = await supabase
    .from("fights")
    .select("id, athlete_id, fought_on, result, rounds, created_at, level")
    .eq("athlete_id", user!.id);
  const { data: titles } = await supabase.from("titles").select("id, org, name, colour, won_on").eq("athlete_id", user!.id).order("won_on", { ascending: false, nullsFirst: false });
  const planned = profile.next_fight_date;
  const defaultDate = planned && planned <= today ? planned : today;

  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading sub="Log each fight's result and how many rounds it went.">
        Competition Tracker
      </Heading>
      <Tip profile={profile} tipKey="fights" />
      <FightLevelPicker level={(profile as unknown as { fight_level: "amateur" | "pro" | null }).fight_level ?? null} next="/fights" readOnly={!!viewAs} />
      <FightRecordView
        fights={(data ?? []) as Fight[]}
        back="/fights"
        thisYear={Number(today.slice(0, 4))}
      />
      <div className="mt-6">
        <TitlesEditor titles={(titles ?? []) as Title[]} next="/fights" error={sp.title_error ?? null} today={today} readOnly={!!viewAs} />
      </div>
      <div id="log" className="scroll-mt-6" />
      <Card className="mt-6">
        <h2 className="mb-4 text-lg font-black uppercase">Log a fight</h2>
        <FightForm defaultDate={defaultDate} today={today} defaultLevel={(profile as unknown as { fight_level: "amateur" | "pro" | null }).fight_level ?? "amateur"} />
      </Card>
    </Screen>
  );
}
