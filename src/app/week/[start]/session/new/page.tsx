import Link from "next/link";
import { redirect } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { isEditableWeek, isLoggableDate, mondayOf, weekDays } from "@/lib/week";
import { getCatalog } from "@/lib/catalog";
import { Heading, Screen } from "@/components/ui";
import { SessionForm } from "@/components/SessionForm";

export default async function NewSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ start: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { supabase } = await requireState(["athlete", "coach"]);
  const { start } = await params;
  const { day } = await searchParams;
  const today = todayISO();
  if (!isEditableWeek(start, today)) redirect(`/week/${mondayOf(today)}`);
  const days = weekDays(start);
  const defaultDay = day && days.includes(day) && isLoggableDate(day, today) ? day : undefined;

  return (
    <Screen>
      <Link href={`/week/${start}`} className="mb-4 inline-block text-sm text-muted">
        ← Back to week
      </Link>
      <Heading>Add session</Heading>
      <SessionForm week={start} days={days} today={today} catalog={await getCatalog(supabase)} defaultDay={defaultDay} />
    </Screen>
  );
}
