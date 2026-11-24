import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { addDays, mondayOf } from "@/lib/week";
import { ISO_DATE } from "@/lib/programming/patterns";
import type { Workout } from "@/lib/programming/types";
import { statusFor, WorkoutCalendar } from "@/components/WorkoutCalendar";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { addWorkout, unassign } from "@/app/coach/workouts/actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

export default async function ClientProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; error?: string; removed?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const sp = await searchParams;
  const today = todayISO();
  const from = mondayOf(sp.from && ISO_DATE.test(sp.from) ? sp.from : today);
  const to = addDays(from, 27);

  const [{ data: client }, { data: workouts }, { data: logs }, { data: assignments }, { data: groups }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("id", id).maybeSingle(),
      supabase.rpc("client_workouts", { p_athlete: id, p_from: from, p_to: to }),
      supabase
        .from("workout_logs")
        .select("workout_id, completed_at")
        .eq("athlete_id", id)
        .gte("workout_date", from)
        .lte("workout_date", to),
      supabase
        .from("assignments")
        .select("id, program_name, start_date")
        .eq("athlete_id", id)
        .order("start_date", { ascending: false }),
      supabase.from("group_members").select("groups(id, name)").eq("athlete_id", id),
    ]);
  if (!client) notFound();
  const logBy = new Map((logs ?? []).map((l) => [l.workout_id, l]));
  const name = client.full_name ?? client.email;
  const back = `/coach/athlete/${id}/program?from=${from}`;

  return (
    <Screen wide>
      <BackLink href={`/coach/athlete/${id}`} label={name} />
      <Heading sub="Tap a workout to edit it or see what was logged.">Program</Heading>
      {sp.error && <Alert>{sp.error}</Alert>}
      {sp.removed && <Alert tone="ok">Removed {sp.removed} upcoming workouts. Past and logged ones are kept.</Alert>}

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card className="!p-4">
          <h2 className="mb-2 font-extrabold">Programs</h2>
          {(assignments ?? []).length === 0 && <p className="text-sm text-muted">None assigned yet.</p>}
          <ul className="space-y-2 text-sm">
            {(assignments ?? []).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span>
                  {a.program_name} <span className="text-muted">from {a.start_date}</span>
                </span>
                <form action={unassign}>
                  <input type="hidden" name="assignment_id" value={a.id} />
                  <input type="hidden" name="back" value={back} />
                  <button className="text-xs text-muted underline underline-offset-4">Remove upcoming</button>
                </form>
              </li>
            ))}
          </ul>
          {(groups ?? []).length > 0 && (
            <p className="mt-3 text-sm text-muted">
              Also gets workouts from:{" "}
              {(groups ?? []).map((g, i) => {
                const grp = g.groups as unknown as { id: string; name: string };
                return (
                  <span key={grp.id}>
                    {i > 0 && ", "}
                    <Link href={`/coach/groups/${grp.id}`} className="underline underline-offset-4">
                      {grp.name}
                    </Link>
                  </span>
                );
              })}
            </p>
          )}
          <Link href="/coach/programs" className="mt-3 inline-block text-sm font-bold text-brand">
            Assign a program →
          </Link>
        </Card>
        <Card className="!p-4">
          <h2 className="mb-2 font-extrabold">One-off workout</h2>
          <form action={addWorkout} className="space-y-2">
            <input type="hidden" name="target" value={`a:${id}`} />
            <input type="hidden" name="back" value={back} />
            <input name="title" placeholder="Title" maxLength={80} className={input} aria-label="Title" />
            <div className="flex gap-2">
              <input name="date" type="date" defaultValue={today} required className={input} aria-label="Date" />
              <button className={smallBtn}>Add</button>
            </div>
          </form>
        </Card>
      </div>

      <WorkoutCalendar
        from={from}
        today={today}
        navBase={`/coach/athlete/${id}/program`}
        workouts={((workouts ?? []) as Workout[]).map((w) => ({
          id: w.id,
          workout_date: w.workout_date,
          title: w.title,
          status: statusFor(w.workout_date, today, logBy.get(w.id)),
          note: w.group_id ? "Group" : w.overrides_id ? "Personalised" : undefined,
        }))}
      />
    </Screen>
  );
}
