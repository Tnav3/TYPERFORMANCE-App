import Link from "next/link";
import { requireFeature } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { addDays, dayMonth, dayShort } from "@/lib/week";
import type { Workout } from "@/lib/programming/types";
import { BackLink, Card, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TrainPage() {
  const { supabase, user } = await requireFeature(["athlete"], "program");
  const today = todayISO();
  const from = addDays(today, -7);
  const to = addDays(today, 13);
  const [{ data: workouts }, { data: logs }] = await Promise.all([
    supabase.rpc("my_workouts", { p_from: from, p_to: to }),
    supabase
      .from("workout_logs")
      .select("workout_id, completed_at")
      .eq("athlete_id", user!.id)
      .gte("workout_date", from),
  ]);
  const { data: phaseRows } = await supabase
    .from("phases")
    .select("name, goal, start_date, end_date")
    .lte("start_date", today)
    .gte("end_date", today)
    .limit(1);
  const phase = phaseRows?.[0];
  const list = (workouts ?? []) as Workout[];
  const logBy = new Map((logs ?? []).map((l) => [l.workout_id, l]));
  const todays = list.filter((w) => w.workout_date === today);
  const upcoming = list.filter((w) => w.workout_date > today);
  const missed = list.filter((w) => w.workout_date < today && !logBy.get(w.id)?.completed_at);
  const doneRecent = list.filter((w) => w.workout_date < today && logBy.get(w.id)?.completed_at);

  const Row = ({ w }: { w: Workout }) => {
    const log = logBy.get(w.id);
    const state = log?.completed_at ? "Done" : log ? "Started" : null;
    return (
      <Link href={`/train/${w.id}`} className="block">
        <Card className="!p-4 hover:border-muted">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-muted">
                {w.workout_date === today ? "Today" : `${dayShort(w.workout_date)} ${dayMonth(w.workout_date)}`}
              </p>
              <p className="truncate text-lg font-black uppercase tracking-tight">{w.title}</p>
            </div>
            {state && (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${state === "Done" ? "bg-ok/15 text-ok" : "bg-surface-2 text-muted"}`}>
                {state}
              </span>
            )}
          </div>
        </Card>
      </Link>
    );
  };

  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading>Training</Heading>
      {phase && (
        <div className="mb-4 rounded-xl border border-line bg-surface p-3 text-sm">
          <span className="text-xs uppercase tracking-widest text-muted">Current phase</span>
          <p className="font-black uppercase">
            {phase.name}{" "}
            <span className="font-normal normal-case text-muted">
              · week {Math.floor((Date.parse(today) - Date.parse(phase.start_date)) / 604800000) + 1} of{" "}
              {Math.ceil((Date.parse(phase.end_date) - Date.parse(phase.start_date) + 86400000) / 604800000)}
            </span>
          </p>
          {phase.goal && <p className="text-muted">{phase.goal}</p>}
        </div>
      )}

      <section className="mb-6 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Today</h2>
        {todays.length ? todays.map((w) => <Row key={w.id} w={w} />) : (
          <p className="rounded-xl border border-dashed border-line p-4 text-center text-muted">Rest day. Recover well.</p>
        )}
      </section>

      {missed.length > 0 && (
        <section className="mb-6 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-warn">Not logged yet</h2>
          {missed.map((w) => <Row key={w.id} w={w} />)}
        </section>
      )}

      <section className="mb-6 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Coming up</h2>
        {upcoming.length ? upcoming.map((w) => <Row key={w.id} w={w} />) : (
          <p className="text-sm text-muted">Nothing scheduled yet. Your coach will add more soon.</p>
        )}
      </section>

      {doneRecent.length > 0 && (
        <section className="mb-6 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Done this past week</h2>
          {doneRecent.reverse().map((w) => <Row key={w.id} w={w} />)}
        </section>
      )}

      <Link href="/train/history" className="text-sm text-muted underline underline-offset-4">
        Exercise history & PRs
      </Link>
    </Screen>
  );
}
