// "Training plan" (periodisation: phases/cycles) card for a client or group page.
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentPhase } from "@/lib/programming/periodisation";
import { createSeason } from "@/app/coach/plan/actions";

export async function SeasonList({
  supabase,
  target,
  back,
  today,
}: {
  supabase: SupabaseClient;
  target: { athlete_id: string } | { group_id: string };
  back: string;
  today: string;
}) {
  const col = "athlete_id" in target ? "athlete_id" : "group_id";
  const val = "athlete_id" in target ? target.athlete_id : target.group_id;
  const { data } = await supabase
    .from("seasons")
    .select("id, name, phases(name, start_date, end_date)")
    .eq(col, val)
    .order("created_at", { ascending: false });
  const seasons = (data ?? []) as { id: string; name: string; phases: { name: string; start_date: string; end_date: string }[] }[];
  const form = (
    <form action={createSeason} className="flex gap-2">
      <input type="hidden" name="target" value={"athlete_id" in target ? `a:${val}` : `g:${val}`} />
      <input type="hidden" name="back" value={back} />
      <input
        name="name"
        required
        maxLength={80}
        placeholder="New plan, e.g. 10-week fight camp"
        className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none"
        aria-label="Training plan name"
      />
      <button className="min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold">Create</button>
    </form>
  );
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Training plan</h2>
        {seasons.length === 0 && <span className="text-sm text-muted">No phases planned yet. Map out blocks (GPP, strength, peak, taper) before you program.</span>}
        {seasons.map((s) => {
          const cur = currentPhase(s.phases, today);
          return (
            <Link key={s.id} href={`/coach/plan/${s.id}`} className="flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-sm hover:border-brand">
              <span className="font-bold">{s.name}</span>
              <span className={cur ? "rounded-full bg-brand/15 px-2 py-0.5 text-xs font-bold text-brand" : "text-xs text-muted"}>
                {cur ? `Now: ${cur.name}` : `${s.phases.length} phase${s.phases.length === 1 ? "" : "s"}`}
              </span>
            </Link>
          );
        })}
        <details className="ml-auto">
          <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-xl px-3 text-sm font-bold text-brand">+ New plan</summary>
          <div className="mt-2 w-80 max-w-full">{form}</div>
        </details>
      </div>
    </div>
  );
}
