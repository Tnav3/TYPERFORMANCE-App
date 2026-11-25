import { ClientTabs } from "@/components/ClientTabs";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import type { Fight } from "@/lib/fights";
import { FightForm } from "@/components/FightForm";
import { FightRecordView } from "@/components/FightRecordView";
import { TitlesEditor } from "@/components/TitlesEditor";
import { FightLevelPicker } from "@/components/FightLevelPicker";
import type { Title } from "@/lib/titles";
import { Card, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CoachAthleteFights({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ title_error?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const today = todayISO();
  const [{ data: p }, { data }, { data: titles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, next_fight_date, fight_level")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("fights")
      .select("id, athlete_id, fought_on, result, rounds, created_at, level")
      .eq("athlete_id", id),
    supabase.from("titles").select("id, org, name, colour, won_on").eq("athlete_id", id).order("won_on", { ascending: false, nullsFirst: false }),
  ]);
  if (!p) notFound();
  const back = `/coach/athlete/${id}/fights`;
  const planned = p.next_fight_date as string | null;

  return (
    <Screen wide>
      <ClientTabs id={id} name={p.full_name ?? p.email} active="fights" />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
      <div>
      <FightLevelPicker level={(p.fight_level as "amateur" | "pro" | null) ?? null} athleteId={id} next={back} who="Competes as" />
      <FightRecordView
        fights={(data ?? []) as Fight[]}
        back={back}
        thisYear={Number(today.slice(0, 4))}
      />
      <div className="mt-6">
        <TitlesEditor titles={(titles ?? []) as Title[]} athleteId={id} next={back} error={sp.title_error ?? null} today={today} />
      </div>
      </div>
      <Card className="mt-6 lg:mt-0">
        <h2 className="mb-4 text-lg font-black uppercase">
          Log a fight for {p.full_name?.split(" ")[0] ?? "them"}
        </h2>
        <FightForm
          athleteId={id}
          defaultDate={planned && planned <= today ? planned : today}
          today={today}
          defaultLevel={(p.fight_level as "amateur" | "pro" | null) ?? "amateur"}
        />
      </Card>
      </div>
    </Screen>
  );
}
