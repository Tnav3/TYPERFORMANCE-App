// Coach dashboard: clients who run out of programmed workouts soon.
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate } from "@/lib/dates";
import { programRunway } from "@/lib/programming/runway";

export async function NeedsProgramPanel({
  supabase,
  today,
}: {
  supabase: SupabaseClient;
  today: string;
}) {
  const [{ data: clients }, { data: workouts }, { data: members }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, feat_program")
      .eq("role", "athlete")
      .eq("status", "active"),
    supabase.from("workouts").select("athlete_id, group_id, workout_date").gte("workout_date", today),
    supabase.from("group_members").select("group_id, athlete_id"),
  ]);
  const rows = programRunway(
    today,
    (clients ?? [])
      .filter((c) => c.feat_program !== false)
      .map((c) => ({ id: c.id, name: c.full_name ?? c.email })),
    workouts ?? [],
    members ?? [],
  );
  if (rows.length === 0)
    return (
      <p className="mb-6 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
        Everyone is programmed for at least the next 2 weeks.
      </p>
    );
  const label = { none: "Nothing scheduled", week: "Runs out this week", fortnight: "Runs out next week" };
  const tone = { none: "bg-brand", week: "bg-brand", fortnight: "bg-warn" };

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
        Needs a program · {rows.length}
      </h2>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/coach/athlete/${r.id}/program`}
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone[r.urgency]}`} aria-hidden />
              <span className="min-w-0 flex-1 font-semibold">{r.name}</span>
              <span className="text-right text-xs text-muted">
                {label[r.urgency]}
                {r.lastDate && (
                  <>
                    <br />
                    last {formatDate(r.lastDate)} ({r.daysLeft}d)
                  </>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
