// Progress screens shared by the client and the coach.
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { dayMonth } from "@/lib/week";
import { repPRs, rollingAverage, sessions, type LoggedSet } from "@/lib/programming/history";
import type { Exercise } from "@/lib/programming/types";
import { WeightChart } from "@/components/WeightChart";
import { Card } from "@/components/ui";

const UNIT: Record<string, string> = { time: "s", distance: "m", calories: "cal" };

/** List of every exercise logged, with latest best e1RM and change since first. */
export function ExerciseList({
  rows,
  exercises,
  hrefBase,
}: {
  rows: (LoggedSet & { key: string })[];
  exercises: Map<string, Pick<Exercise, "id" | "name" | "measure">>;
  hrefBase: string;
}) {
  const by = new Map<string, LoggedSet[]>();
  for (const r of rows) by.set(r.key, [...(by.get(r.key) ?? []), r]);
  const list = [...by.entries()]
    .map(([key, sets]) => {
      const ss = sessions(sets);
      const withE = ss.filter((s) => s.bestE1rm != null);
      const best = withE.length ? Math.max(...withE.map((s) => s.bestE1rm!)) : null;
      const first = withE.length ? withE[withE.length - 1].bestE1rm! : null;
      return { key, name: exercises.get(key)?.name ?? "Exercise", last: ss[0]?.date, count: ss.length, best, first };
    })
    .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""));
  if (!list.length) return <p className="text-muted">Nothing logged yet. Finish a workout and your history shows here.</p>;
  return (
    <div className="space-y-2">
      {list.map((x) => (
        <Link key={x.key} href={`${hrefBase}/${x.key}`} className="block">
          <Card className="!p-3 hover:border-muted">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{x.name}</p>
                <p className="text-xs text-muted">
                  {x.count} session{x.count === 1 ? "" : "s"} · last {x.last ? formatDate(x.last) : "—"}
                </p>
              </div>
              {x.best != null && (
                <div className="text-right">
                  <p className="text-lg font-black">{x.best} kg</p>
                  <p className="text-xs text-muted">
                    best e1RM
                    {x.first != null && x.best > x.first && <span className="ml-1 text-ok">+{Math.round((x.best - x.first) * 10) / 10}</span>}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

/** One exercise: trend, rep PRs, every session. */
export function ExerciseHistory({
  sets,
  measure,
  saveSlot,
}: {
  sets: LoggedSet[];
  measure: string;
  saveSlot?: React.ReactNode;
}) {
  const ss = sessions(sets);
  const timed = measure in UNIT;
  const trend = [...ss].reverse().slice(-20);
  const prs = repPRs(sets);
  const best = ss.reduce<number | null>((a, s) => (s.bestE1rm != null && (a == null || s.bestE1rm > a) ? s.bestE1rm : a), null);

  if (!ss.length) return <p className="text-muted">Nothing logged yet.</p>;
  return (
    <div className="space-y-6">
      {!timed && (
        <Card>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-xs uppercase tracking-widest text-muted">Best e1RM per session</p>
            {best != null && <p className="text-2xl font-black">{best} kg</p>}
          </div>
          <WeightChart
            points={trend.map((s) => ({ week: s.date, label: dayMonth(s.date), kg: s.bestE1rm }))}
            limit={null}
          />
          {saveSlot}
        </Card>
      )}
      {!timed && prs.length > 0 && (
        <Card>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted">Rep personal bests</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {prs.map((p) => (
              <div key={p.reps} className="rounded-xl bg-surface-2 p-2 text-center">
                <p className="text-xs text-muted">{p.reps} rep{p.reps === 1 ? "" : "s"}</p>
                <p className="font-black">{p.kg} kg</p>
                <p className="text-[10px] text-muted">{dayMonth(p.date)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
      <section>
        <p className="mb-2 text-xs uppercase tracking-widest text-muted">Sessions</p>
        <div className="space-y-2">
          {ss.map((s) => (
            <div key={s.date} className="rounded-xl border border-line bg-surface p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-bold">{formatDate(s.date)}</span>
                {s.bestE1rm != null && <span className="text-muted">e1RM {s.bestE1rm} kg</span>}
              </div>
              <p className="mt-1 text-muted">
                {s.sets
                  .map((x) => (timed ? `${x.value ?? "?"}${UNIT[measure]}` : `${x.reps ?? "?"}${x.kg != null ? ` × ${x.kg}` : ""}`))
                  .join(" · ")}
                {!timed && s.volume > 0 && ` · ${s.volume} kg total`}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Bodyweight trend with 7-day average. */
export function BodyweightTrend({
  rows,
  limit,
}: {
  rows: { date: string; kg: number; waist: number | null }[];
  limit: number | null;
}) {
  const asc = [...rows].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  const avg = rollingAverage(asc);
  const latest = avg[avg.length - 1];
  const weekAgo = avg.find((a) => a.date >= new Date(Date.parse(`${latest?.date ?? "2000-01-01"}T00:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10));
  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-widest text-muted">Bodyweight · 7-day average</p>
        {latest && (
          <p className="text-2xl font-black">
            {latest.avg} kg
            {weekAgo && weekAgo.date !== latest.date && (
              <span className={`ml-2 text-sm ${latest.avg <= weekAgo.avg ? "text-ok" : "text-warn"}`}>
                {latest.avg - weekAgo.avg >= 0 ? "+" : ""}
                {Math.round((latest.avg - weekAgo.avg) * 10) / 10}
              </span>
            )}
          </p>
        )}
      </div>
      <WeightChart points={avg.map((a) => ({ week: a.date, label: dayMonth(a.date), kg: a.avg }))} limit={limit} />
    </Card>
  );
}
