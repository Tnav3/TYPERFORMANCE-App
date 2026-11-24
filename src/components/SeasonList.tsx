// "Season plan" card for a client or group page.
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
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 font-extrabold">Season plan</h2>
      <ul className="space-y-1 text-sm">
        {seasons.map((s) => {
          const cur = currentPhase(s.phases, today);
          return (
            <li key={s.id}>
              <Link href={`/coach/plan/${s.id}`} className="font-bold underline underline-offset-4">
                {s.name}
              </Link>
              <span className="text-muted"> · {cur ? `now: ${cur.name}` : `${s.phases.length} phases`}</span>
            </li>
          );
        })}
      </ul>
      <form action={createSeason} className="mt-3 flex gap-2">
        <input type="hidden" name="target" value={"athlete_id" in target ? `a:${val}` : `g:${val}`} />
        <input type="hidden" name="back" value={back} />
        <input
          name="name"
          required
          maxLength={80}
          placeholder="New season, e.g. Road to the title"
          className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none"
          aria-label="Season name"
        />
        <button className="min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold">Create</button>
      </form>
    </div>
  );
}
