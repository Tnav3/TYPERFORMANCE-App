import { Trophy, Lock } from "lucide-react";
import { requireState } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { loggedSets } from "@/lib/programming/history-data";
import { pbEvents } from "@/lib/programming/history";
import { cabinet, fightBadges, tracks } from "@/lib/trophies";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TrophiesPage() {
  const { supabase, user, viewAs } = await requireState(["athlete"]);
  const me = user!.id;
  const [{ data: earned }, { count: workouts }, all, { data: fights }] = await Promise.all([
    supabase.from("badges").select("key, detail, earned_on").eq("athlete_id", me),
    supabase.from("workout_logs").select("id", { count: "exact", head: true }).eq("athlete_id", me).not("completed_at", "is", null),
    loggedSets(supabase, me),
    supabase.from("fights").select("result").eq("athlete_id", me),
  ]);
  const nFights = fights?.length ?? 0;
  const wins = (fights ?? []).filter((f) => f.result === "win").length;
  const held = new Map((earned ?? []).map((b) => [b.key, b]));
  const fresh = fightBadges(nFights, wins).filter((b) => !held.has(b.key));
  if (fresh.length && !viewAs) {
    const { data: added } = await supabase.from("badges").insert(fresh.map((b) => ({ athlete_id: me, key: b.key, detail: b.title }))).select("key, detail, earned_on");
    for (const b of added ?? []) held.set(b.key, b);
  }
  const { views, earned: got, total } = cabinet(tracks({ workouts: workouts ?? 0, pbs: pbEvents(all).length, fights: nFights, wins }), new Set(held.keys()));

  return (
    <Screen>
      <BackLink href="/more" label="More" />
      <Heading sub={`${got} of ${total} earned`}>Trophy cabinet</Heading>
      <div className="space-y-3">
        {views.map((v) => (
          <section key={v.track.key} className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-bold">{v.track.title}</h2>
              <span className="text-xs text-muted">{v.earned}/{v.track.steps.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {v.track.steps.map((s) => {
                const b = held.get(s.key);
                return (
                  <div
                    key={s.key}
                    title={b ? `${b.detail ?? ""} · ${formatDate(b.earned_on)}` : `Locked: ${s.at} ${v.track.unit}`}
                    className={`flex h-14 w-14 flex-col items-center justify-center rounded-xl border text-xs font-black ${b ? "border-brand bg-brand/15 text-text" : "border-line bg-surface-2 text-muted/60"}`}
                  >
                    {b ? <Trophy size={16} className="text-brand" /> : <Lock size={14} />}
                    <span className="mt-0.5">{s.label}</span>
                  </div>
                );
              })}
            </div>
            {v.next && (
              <div className="mt-3">
                {v.next.pct != null ? (
                  <>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${v.next.pct}%` }} /></div>
                    <p className="mt-1 text-xs text-muted">{v.next.have} of {v.next.at} {v.track.unit} for the next one</p>
                  </>
                ) : (
                  <p className="text-xs text-muted">Next: {v.next.at} {v.track.unit}</p>
                )}
              </div>
            )}
          </section>
        ))}
      </div>
    </Screen>
  );
}
