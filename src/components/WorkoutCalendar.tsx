// Coach calendar: 4 weeks of dated workouts with completion status.
import Link from "next/link";
import { addDays, dayMonth, dayShort, mondayOf } from "@/lib/week";

export type CalStatus = "done" | "partial" | "missed" | "planned";

export interface CalWorkout {
  id: string;
  workout_date: string;
  title: string;
  status: CalStatus;
  note?: string; // e.g. "3/5 done" for groups, "Personal" for overrides
}

const DOT: Record<CalStatus, string> = {
  done: "bg-ok",
  partial: "bg-warn",
  missed: "bg-brand",
  planned: "bg-line",
};
const LABEL: Record<CalStatus, string> = {
  done: "Done",
  partial: "Started",
  missed: "Missed",
  planned: "Planned",
};

/** Status of one workout for one client, given their log (if any). */
export function statusFor(
  date: string,
  today: string,
  log: { completed_at: string | null } | undefined,
): CalStatus {
  if (log?.completed_at) return "done";
  if (log) return "partial";
  return date < today ? "missed" : "planned";
}

export function WorkoutCalendar({
  from,
  weeks = 4,
  today,
  workouts,
  navBase,
}: {
  from: string;
  weeks?: number;
  today: string;
  workouts: CalWorkout[];
  navBase: string; // e.g. "/coach/athlete/123/program" — gets ?from=
}) {
  const start = mondayOf(from);
  const byDate = new Map<string, CalWorkout[]>();
  for (const w of workouts) byDate.set(w.workout_date, [...(byDate.get(w.workout_date) ?? []), w]);
  const sep = navBase.includes("?") ? "&" : "?";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm">
        <Link href={`${navBase}${sep}from=${addDays(start, -7 * weeks)}`} className="min-h-11 content-center text-muted underline underline-offset-4">
          ‹ Earlier
        </Link>
        <Link href={`${navBase}${sep}from=${mondayOf(today)}`} className="min-h-11 content-center text-muted underline underline-offset-4">
          This week
        </Link>
        <Link href={`${navBase}${sep}from=${addDays(start, 7 * weeks)}`} className="min-h-11 content-center text-muted underline underline-offset-4">
          Later ›
        </Link>
      </div>
      <div className="space-y-4">
        {Array.from({ length: weeks }, (_, w) => {
          const mon = addDays(start, w * 7);
          return (
            <section key={mon}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
                Week of {dayMonth(mon)}
              </h3>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-7">
                {Array.from({ length: 7 }, (_, d) => {
                  const date = addDays(mon, d);
                  const list = byDate.get(date) ?? [];
                  return (
                    <div
                      key={date}
                      className={`min-h-12 rounded-lg border p-1.5 text-xs ${date === today ? "border-brand" : "border-line"} ${list.length ? "bg-surface" : ""}`}
                    >
                      <p className="text-muted">
                        {dayShort(date)} {dayMonth(date)}
                      </p>
                      {list.map((w) => (
                        <Link
                          key={w.id}
                          href={`/coach/workouts/${w.id}`}
                          className="mt-1 flex items-start gap-1.5 rounded-md px-1 py-0.5 hover:bg-surface-2"
                          title={LABEL[w.status]}
                        >
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[w.status]}`} aria-label={LABEL[w.status]} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-text">{w.title}</span>
                            {w.note && <span className="block text-muted">{w.note}</span>}
                          </span>
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        {(Object.keys(DOT) as CalStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${DOT[s]}`} /> {LABEL[s]}
          </span>
        ))}
      </p>
    </div>
  );
}
