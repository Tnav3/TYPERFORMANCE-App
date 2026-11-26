// Group board for semi-private groups: effort this week, not loads, so it's fair across sizes.
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = { athlete_id: string; name: string; sessions_week: number; sets_week: number; pbs_28: number; is_me: boolean };

export async function GroupBoard({ supabase, groupId, title }: { supabase: SupabaseClient; groupId: string; title?: string }) {
  const { data } = await supabase.rpc("group_board", { p_group: groupId });
  const rows = (data ?? []) as Row[];
  if (!rows.length) return null;
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">{title ?? "Group board"} · this week</h2>
        <span className="text-[11px] text-muted">PBs = last 4 weeks</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-widest text-muted">
            <th className="py-1 font-semibold" />
            <th className="py-1 text-right font-semibold">Sessions</th>
            <th className="py-1 text-right font-semibold">Sets</th>
            <th className="py-1 text-right font-semibold">PBs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.athlete_id} className={`border-t border-line ${r.is_me ? "font-black text-brand" : ""}`}>
              <td className="py-1.5">
                <span className="mr-1.5 inline-block w-5">{r.sessions_week > 0 ? medal[i] ?? "" : ""}</span>
                {r.name}{r.is_me ? " (you)" : ""}
              </td>
              <td className="py-1.5 text-right font-bold">{r.sessions_week}</td>
              <td className="py-1.5 text-right">{r.sets_week}</td>
              <td className="py-1.5 text-right">{r.pbs_28 ? `🏆 ${r.pbs_28}` : "0"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
