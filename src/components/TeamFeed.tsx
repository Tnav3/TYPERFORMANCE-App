// "Team" card on Home: who in your group has trained this week. Opt-in per group by the coach.
import { Avatar } from "@/components/Avatar";

export interface TeamRow {
  group_name: string;
  athlete_id: string;
  first_name: string;
  avatar_path: string | null;
  workout_title: string;
  completed_at: string;
  is_me: boolean;
}

function ago(iso: string, now: number) {
  const m = Math.max(1, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function TeamFeed({ rows, now }: { rows: TeamRow[]; now: number }) {
  if (!rows.length) return null;
  const people = new Set(rows.map((r) => r.athlete_id)).size;
  const groups = [...new Set(rows.map((r) => r.group_name))];
  return (
    <section className="mb-5 rounded-2xl border border-line bg-surface p-4" aria-label="Team activity">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted">{groups.length === 1 ? groups[0] : "Your team"}</h2>
        <span className="text-xs text-muted">{people} trained this week</span>
      </div>
      <ul className="space-y-2">
        {rows.slice(0, 5).map((r) => (
          <li key={r.athlete_id + r.completed_at} className="flex items-center gap-3 text-sm">
            <Avatar name={r.first_name} path={r.avatar_path} size="sm" tone="soft" />
            <span className="min-w-0 flex-1 truncate">
              <b>{r.is_me ? "You" : r.first_name}</b> <span className="text-muted">finished</span> {r.workout_title}
            </span>
            <span className="shrink-0 text-xs text-muted">{ago(r.completed_at, now)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
