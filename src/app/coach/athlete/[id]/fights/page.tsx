import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import type { Fight } from "@/lib/fights";
import { FightForm } from "@/components/FightForm";
import { FightRecordView } from "@/components/FightRecordView";
import { BackLink, Card, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CoachAthleteFights({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const today = todayISO();
  const [{ data: p }, { data }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, next_fight_date")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("fights")
      .select("id, athlete_id, fought_on, result, rounds, created_at")
      .eq("athlete_id", id),
  ]);
  if (!p) notFound();
  const back = `/coach/athlete/${id}/fights`;
  const planned = p.next_fight_date as string | null;

  return (
    <Screen>
      <BackLink
        href={`/coach/athlete/${id}`}
        label={p.full_name ?? "Athlete"}
      />
      <Heading sub={p.email}>Competition Tracker</Heading>
      <FightRecordView
        fights={(data ?? []) as Fight[]}
        back={back}
        thisYear={Number(today.slice(0, 4))}
      />
      <Card className="mt-6">
        <h2 className="mb-4 text-lg font-black uppercase">
          Log a fight for {p.full_name?.split(" ")[0] ?? "them"}
        </h2>
        <FightForm
          athleteId={id}
          defaultDate={planned && planned <= today ? planned : today}
          today={today}
        />
      </Card>
    </Screen>
  );
}
