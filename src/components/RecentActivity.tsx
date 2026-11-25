// Coach dashboard: who just trained, how hard, PBs, their comments, and a one-tap reaction.
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pbEvents } from "@/lib/programming/history";
import { usesE1rm } from "@/lib/programming/e1rm-scope";
import { formatDate } from "@/lib/dates";
import { REACTIONS, ago } from "@/lib/reactions";
import { reactToLog, replyToLog } from "@/app/coach/feed/actions";

type Log = {
  id: string;
  athlete_id: string;
  workout_date: string;
  completed_at: string;
  session_rpe: number | null;
  duration_min: number | null;
  comment: string | null;
  coach_seen_at: string | null;
  coach_reaction?: string | null;
  profiles: { full_name: string | null; email: string } | null;
  workouts: { title: string } | null;
  item_logs: { comment: string | null }[];
};

const COLS = "id, athlete_id, workout_date, completed_at, session_rpe, duration_min, comment, coach_seen_at, profiles!workout_logs_athlete_id_fkey(full_name, email), workouts(title), item_logs(comment)";

export async function RecentActivity({ supabase, limit = 10, back = "/coach" }: { supabase: SupabaseClient; limit?: number; back?: string }) {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const load = (cols: string) =>
    supabase.from("workout_logs").select(cols).not("completed_at", "is", null).gte("completed_at", since).order("completed_at", { ascending: false }).limit(limit);
  const first = await load(`${COLS}, coach_reaction`);
  const { data } = first.error ? await load(COLS) : first; // before migration 097 is applied
  const logs = (data ?? []) as unknown as Log[];
  if (!logs.length) return null;

  const ids = [...new Set(logs.map((l) => l.athlete_id))];
  const { data: sets } = await supabase
    .from("set_logs")
    .select("reps, load_kg, exercise_id, exercises(name, category), workout_logs!inner(workout_date, athlete_id)")
    .in("workout_logs.athlete_id", ids)
    .not("exercise_id", "is", null)
    .eq("done", true)
    .gt("load_kg", 0)
    .limit(20000);
  const exName = new Map<string, string>();
  const rows = ((sets ?? []) as unknown as {
    reps: number | null;
    load_kg: string | null;
    exercise_id: string;
    exercises: { name: string; category: string | null } | null;
    workout_logs: { workout_date: string; athlete_id: string };
  }[]).filter((r) => usesE1rm({ name: r.exercises?.name ?? "", category: r.exercises?.category })).map((r) => {
    exName.set(r.exercise_id, r.exercises?.name ?? "Exercise");
    return { key: `${r.workout_logs.athlete_id}|${r.exercise_id}`, date: r.workout_logs.workout_date, reps: r.reps, kg: r.load_kg == null ? null : Number(r.load_kg), value: null };
  });
  const pbBy = new Map<string, { name: string; e1rm: number }[]>();
  for (const e of pbEvents(rows)) {
    if (e.previous <= 0) continue;
    const [athlete, ex] = e.key.split("|");
    const k = `${athlete}|${e.date}`;
    pbBy.set(k, [...(pbBy.get(k) ?? []), { name: exName.get(ex) ?? "Exercise", e1rm: Math.round(e.e1rm) }]);
  }

  const now = new Date();
  const unseen = logs.filter((l) => !l.coach_seen_at).length;
  return (
    <section className="mb-8" id="recent-activity">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Recent activity{unseen ? ` · ${unseen} new` : ""}
        </h2>
        <Link href="/coach/feed" className="text-xs font-bold text-muted underline underline-offset-4">All sessions</Link>
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {logs.map((l) => {
          const name = l.profiles?.full_name ?? l.profiles?.email ?? "Client";
          const pbs = pbBy.get(`${l.athlete_id}|${l.workout_date}`) ?? [];
          const notes = l.item_logs.filter((i) => i.comment).map((i) => i.comment!);
          const here = `${back}#log-${l.id}`;
          return (
            <div key={l.id} id={`log-${l.id}`} className={`scroll-mt-4 p-3 ${l.coach_seen_at ? "" : "bg-brand/5"}`}>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/coach/logs/${l.id}`} className="min-w-0 hover:underline">
                  <p className="font-bold">
                    {name}
                    {!l.coach_seen_at && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-brand align-middle" aria-label="New" />}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {l.workouts?.title ?? "Own session"} · {ago(l.completed_at, now)}
                  </p>
                </Link>
                <div className="shrink-0 text-right">
                  {l.session_rpe != null && <p className="text-base font-black">RPE {l.session_rpe}</p>}
                  {l.duration_min != null && <p className="text-xs text-muted">{l.duration_min} min</p>}
                </div>
              </div>
              {pbs.length > 0 && (
                <p className="mt-1.5 flex flex-wrap gap-1.5">
                  {pbs.slice(0, 3).map((p) => (
                    <span key={p.name} className="rounded-full bg-ok/15 px-2 py-0.5 text-xs font-bold text-ok">
                      🏆 PB {p.name} · e1RM {p.e1rm} kg
                    </span>
                  ))}
                  {pbs.length > 3 && <span className="text-xs text-muted">+{pbs.length - 3} more</span>}
                </p>
              )}
              {l.comment && <p className="mt-1.5 text-sm">“{l.comment}”</p>}
              {notes.length > 0 && (
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer list-none text-xs font-bold text-brand">{notes.length} exercise note{notes.length === 1 ? "" : "s"} ▾</summary>
                  <ul className="mt-1 space-y-0.5 text-muted">{notes.map((n, i) => <li key={i}>“{n}”</li>)}</ul>
                </details>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {REACTIONS.map((e) => (
                  <form key={e} action={reactToLog}>
                    <input type="hidden" name="log_id" value={l.id} />
                    <input type="hidden" name="emoji" value={e} />
                    <input type="hidden" name="back" value={here} />
                    <button
                      aria-label={`React ${e} to ${name}'s session`}
                      aria-pressed={l.coach_reaction === e}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition ${l.coach_reaction === e ? "border-brand bg-brand/15" : "border-line bg-surface-2 hover:border-muted"}`}
                    >
                      {e}
                    </button>
                  </form>
                ))}
                <details className="ml-auto">
                  <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-xl border border-line px-3 text-sm font-bold">Reply</summary>
                  <form action={replyToLog} className="mt-2 flex w-[min(80vw,360px)] gap-2">
                    <input type="hidden" name="log_id" value={l.id} />
                    <input type="hidden" name="back" value={here} />
                    <input name="body" required maxLength={1800} placeholder={`Message ${name.split(" ")[0]}…`} className="min-h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm" aria-label="Reply" />
                    <button className="min-h-10 shrink-0 rounded-xl bg-brand px-3 text-sm font-extrabold uppercase text-white">Send</button>
                  </form>
                </details>
              </div>
              {l.coach_reaction && <p className="mt-1 text-[11px] text-muted">You reacted {l.coach_reaction} · {name.split(" ")[0]} was notified · {formatDate(l.workout_date)}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
