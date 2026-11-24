import { requireFeature } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { BackLink, Card, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text focus:border-brand focus:outline-none";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string; ex?: string }>;
}) {
  const { supabase, user } = await requireFeature(["athlete"], "leaderboard");
  const sp = await searchParams;
  const [{ data: groups }, { data: exercises }] = await Promise.all([
    supabase.from("groups").select("id, name").eq("archived", false).order("name"),
    supabase.from("exercises").select("id, name").eq("active", true).in("category", ["strength", "power"]).order("name"),
  ]);
  const g = sp.g ?? groups?.[0]?.id;
  const ex = sp.ex ?? exercises?.find((e) => e.name === "Back Squat")?.id ?? exercises?.[0]?.id;
  const { data: board } = g && ex ? await supabase.rpc("group_leaderboard", { p_group: g, p_exercise: ex }) : { data: [] };
  const rows = (board ?? []) as { athlete_id: string; name: string; best_e1rm: number; best_load: number; best_reps: number; on_date: string }[];

  return (
    <Screen>
      <BackLink href="/train/history" label="My progress" />
      <Heading sub="Best estimated 1RM from logged sets. Only teammates who opted in appear.">Leaderboard</Heading>
      {!groups?.length ? (
        <p className="text-muted">You&apos;re not in a group yet.</p>
      ) : (
        <>
          <form className="mb-4 grid grid-cols-[1fr_1fr_auto] gap-2">
            <select name="g" defaultValue={g} className={input} aria-label="Group">
              {groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <select name="ex" defaultValue={ex} className={input} aria-label="Exercise">
              {(exercises ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <button className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold">Go</button>
          </form>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <Card key={r.athlete_id} className={`!p-3 ${r.athlete_id === user!.id ? "border-brand/60" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-8 text-center text-xl font-black ${i < 3 ? "text-brand" : "text-muted"}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{r.name}</p>
                    <p className="text-xs text-muted">
                      {r.best_reps} × {Number(r.best_load)} kg · {formatDate(r.on_date)}
                    </p>
                  </div>
                  <p className="text-lg font-black">{Number(r.best_e1rm)} kg</p>
                </div>
              </Card>
            ))}
            {rows.length === 0 && <p className="text-muted">No logged sets for this exercise yet.</p>}
          </div>
        </>
      )}
    </Screen>
  );
}
