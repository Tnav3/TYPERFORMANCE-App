import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { isEditableWeek, mondayOf, weekDays } from "@/lib/week";
import { getCatalog } from "@/lib/catalog";
import { Heading, Screen } from "@/components/ui";
import { SessionForm, type ExistingSession } from "@/components/SessionForm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditSessionPage({ params }: { params: Promise<{ start: string; id: string }> }) {
  const { supabase, user } = await requireState(["athlete", "coach"]);
  const { start, id } = await params;
  const today = todayISO();
  if (!isEditableWeek(start, today)) redirect(`/week/${mondayOf(today)}`);
  if (!UUID.test(id)) notFound();

  const { data: session } = await supabase
    .from("training_sessions")
    .select("id, session_date, start_time, duration_min, discipline_id, session_type_id, rpe, notes")
    .eq("id", id)
    .eq("athlete_id", user!.id)
    .maybeSingle();
  if (!session) notFound();
  // Session belongs to a different week than the URL says → go to the right one
  if (mondayOf(session.session_date) !== start) redirect(`/week/${mondayOf(session.session_date)}/session/${id}`);

  return (
    <Screen>
      <Link href={`/week/${start}`} className="mb-4 inline-block text-sm text-muted">
        ← Back to week
      </Link>
      <Heading>Edit session</Heading>
      <SessionForm
        week={start}
        days={weekDays(start)}
        today={today}
        catalog={await getCatalog(supabase)}
        existing={session as ExistingSession}
      />
    </Screen>
  );
}
