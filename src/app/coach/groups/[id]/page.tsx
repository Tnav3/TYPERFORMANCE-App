import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { addDays, mondayOf } from "@/lib/week";
import { ISO_DATE } from "@/lib/programming/patterns";
import type { CalStatus } from "@/components/WorkoutCalendar";
import { WorkoutCalendar } from "@/components/WorkoutCalendar";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import {
  addMember,
  addWorkout,
  removeMember,
  unassign,
  updateGroup,
} from "@/app/coach/workouts/actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

export default async function GroupPage({
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

  const [{ data: group }, { data: members }, { data: clients }, { data: workouts }, { data: assignments }] =
    await Promise.all([
      supabase.from("groups").select("*").eq("id", id).maybeSingle(),
      supabase.from("group_members").select("athlete_id, profiles(full_name, email)").eq("group_id", id),
      supabase.from("profiles").select("id, full_name, email").eq("role", "athlete").eq("status", "active").order("full_name"),
      supabase
        .from("workouts")
        .select("id, workout_date, title, workout_logs(athlete_id, completed_at)")
        .eq("group_id", id)
        .gte("workout_date", from)
        .lte("workout_date", to)
        .order("workout_date"),
      supabase.from("assignments").select("id, program_name, start_date").eq("group_id", id).order("start_date", { ascending: false }),
    ]);
  if (!group) notFound();
  const memberRows = (members ?? []) as unknown as {
    athlete_id: string;
    profiles: { full_name: string | null; email: string };
  }[];
  const memberIds = new Set(memberRows.map((m) => m.athlete_id));
  const back = `/coach/groups/${id}?from=${from}`;
  const n = memberRows.length;

  const cal = ((workouts ?? []) as unknown as {
    id: string;
    workout_date: string;
    title: string;
    workout_logs: { athlete_id: string; completed_at: string | null }[];
  }[]).map((w) => {
    const done = w.workout_logs.filter((l) => l.completed_at && memberIds.has(l.athlete_id)).length;
    const status: CalStatus =
      n > 0 && done >= n ? "done" : done > 0 ? "partial" : w.workout_date < today ? "missed" : "planned";
    return {
      id: w.id,
      workout_date: w.workout_date,
      title: w.title,
      status,
      note: n ? `${done}/${n} done` : undefined,
    };
  });

  return (
    <Screen wide>
      <BackLink href="/coach/groups" label="Groups" />
      <Heading sub={`${n} ${n === 1 ? "member" : "members"}${group.archived ? " · archived" : ""}`}>{group.name}</Heading>
      {sp.error && <Alert>{sp.error}</Alert>}
      {sp.removed && <Alert tone="ok">Removed {sp.removed} upcoming workouts.</Alert>}

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card className="!p-4">
          <h2 className="mb-2 font-extrabold">Members</h2>
          <ul className="space-y-1">
            {memberRows.map((m) => (
              <li key={m.athlete_id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/coach/athlete/${m.athlete_id}/program`} className="underline underline-offset-4">
                  {m.profiles.full_name ?? m.profiles.email}
                </Link>
                <form action={removeMember}>
                  <input type="hidden" name="group_id" value={id} />
                  <input type="hidden" name="athlete_id" value={m.athlete_id} />
                  <button className="text-xs text-muted underline underline-offset-4">Remove</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addMember} className="mt-3 flex gap-2">
            <input type="hidden" name="group_id" value={id} />
            <select name="athlete_id" required defaultValue="" className={input} aria-label="Client">
              <option value="" disabled>
                Add a client…
              </option>
              {(clients ?? []).filter((c) => !memberIds.has(c.id)).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name ?? c.email}
                </option>
              ))}
            </select>
            <button className={smallBtn}>Add</button>
          </form>
        </Card>
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
          <Link href="/coach/programs" className="mt-2 inline-block text-sm font-bold text-brand">
            Assign a program →
          </Link>
          <form action={addWorkout} className="mt-4 space-y-2">
            <input type="hidden" name="target" value={`g:${id}`} />
            <input type="hidden" name="back" value={back} />
            <p className="text-sm font-bold">One-off group workout</p>
            <input name="title" placeholder="Title" maxLength={80} className={input} aria-label="Title" />
            <div className="flex gap-2">
              <input name="date" type="date" defaultValue={today} required className={input} aria-label="Date" />
              <button className={smallBtn}>Add</button>
            </div>
          </form>
        </Card>
      </div>

      <WorkoutCalendar from={from} today={today} navBase={`/coach/groups/${id}`} workouts={cal} />

      <details className="mt-8 rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-bold">Group settings</summary>
        <form action={updateGroup} className="mt-3 flex gap-2">
          <input type="hidden" name="id" value={id} />
          <input name="name" defaultValue={group.name} maxLength={60} className={input} aria-label="Group name" />
          <button className={smallBtn}>Rename</button>
        </form>
        <form action={updateGroup} className="mt-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="archived" value={String(!group.archived)} />
          <button className="text-sm text-muted underline underline-offset-4">
            {group.archived ? "Restore group" : "Archive group"}
          </button>
        </form>
      </details>
    </Screen>
  );
}
