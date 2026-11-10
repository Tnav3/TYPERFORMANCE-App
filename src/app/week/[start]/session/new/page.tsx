import { redirect } from "next/navigation";
import { Tip } from "@/components/Tip";
import { requireFeature } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { isEditableWeek, isLoggableDate, mondayOf, weekDays } from "@/lib/week";
import { getCatalog } from "@/lib/catalog";
import { Heading, Screen, BackLink } from "@/components/ui";
import { SessionForm } from "@/components/SessionForm";

export default async function NewSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ start: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { supabase, profile } = await requireFeature(
    ["athlete", "coach"],
    "checkin",
  );
  const { start } = await params;
  const { day } = await searchParams;
  const today = todayISO();
  if (!isEditableWeek(start, today)) redirect(`/week/${mondayOf(today)}`);
  const days = weekDays(start);
  const defaultDay =
    day && days.includes(day) && isLoggableDate(day, today) ? day : undefined;

  return (
    <Screen>
      <BackLink href={`/week/${start}`} label="Back to week" />
      <Heading>Add session</Heading>
      <Tip profile={profile} tipKey="log" />
      <SessionForm
        week={start}
        days={days}
        today={today}
        catalog={await getCatalog(supabase)}
        defaultDay={defaultDay}
      />
    </Screen>
  );
}
