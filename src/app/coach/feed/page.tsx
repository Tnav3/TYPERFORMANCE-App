import Link from "next/link";
import { requireState } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { BackLink, Card, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ unseen?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { unseen } = await searchParams;
  let q = supabase
    .from("workout_logs")
    .select(
      "id, workout_date, completed_at, session_rpe, duration_min, comment, coach_seen_at, athlete_id, profiles!workout_logs_athlete_id_fkey(full_name, email), workouts(title), item_logs(comment)",
    )
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(60);
  if (unseen) q = q.is("coach_seen_at", null);
  const { data } = await q;
  const raw = (data ?? []) as unknown as { athlete_id: string; workout_date: string }[];
  const { data: ready } = raw.length
    ? await supabase
        .from("readiness")
        .select("athlete_id, checked_on, score")
        .in("athlete_id", [...new Set(raw.map((r) => r.athlete_id))])
        .gte("checked_on", raw.map((r) => r.workout_date).sort()[0])
    : { data: [] };
  const readyBy = new Map((ready ?? []).map((r) => [`${r.athlete_id}|${r.checked_on}`, r.score as number]));
  const rows = (data ?? []) as unknown as {
    athlete_id: string;
    id: string;
    workout_date: string;
    completed_at: string;
    session_rpe: number;
    duration_min: number;
    comment: string | null;
    coach_seen_at: string | null;
    profiles: { full_name: string | null; email: string };
    workouts: { title: string } | null;
    item_logs: { comment: string | null }[];
  }[];

  return (
    <Screen wide>
      <BackLink href="/coach" label="Dashboard" />
      <Heading sub="Completed workouts, newest first. Open one to see prescribed vs actual.">Workout feed</Heading>
      <div className="mb-4 flex gap-4 text-sm">
        <Link href="/coach/feed" className={unseen ? "text-muted" : "font-bold"}>All</Link>
        <Link href="/coach/feed?unseen=1" className={unseen ? "font-bold" : "text-muted"}>Not reviewed</Link>
      </div>
      <div className="space-y-2">
        {rows.map((r) => {
          const notes = r.item_logs.filter((i) => i.comment).length + (r.comment ? 1 : 0);
          return (
            <Link key={r.id} href={`/coach/logs/${r.id}`} className="block">
              <Card className={`!p-3 hover:border-muted ${r.coach_seen_at ? "" : "border-brand/50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {r.profiles.full_name ?? r.profiles.email}
                      {!r.coach_seen_at && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-brand align-middle" aria-label="Not reviewed" />}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {r.workouts?.title ?? "Workout"} · {formatDate(r.workout_date)}
                    </p>
                    {r.comment && <p className="mt-1 line-clamp-2 text-sm">“{r.comment}”</p>}
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted">
                    <p className="text-base font-black text-text">RPE {r.session_rpe}</p>
                    <p>{r.duration_min} min</p>
                    {readyBy.has(`${r.athlete_id}|${r.workout_date}`) && (
                      <p className={(() => { const sc = readyBy.get(`${r.athlete_id}|${r.workout_date}`)!; return sc >= 70 ? "text-ok" : sc >= 50 ? "text-warn" : "text-brand"; })()}>
                        Ready {readyBy.get(`${r.athlete_id}|${r.workout_date}`)}
                      </p>
                    )}
                    {notes > 0 && <p className="text-brand">{notes} note{notes === 1 ? "" : "s"}</p>}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
        {rows.length === 0 && <p className="text-muted">{unseen ? "All caught up." : "No completed workouts yet."}</p>}
      </div>
    </Screen>
  );
}
