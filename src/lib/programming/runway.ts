// "Needs a program": how far ahead each client is programmed.
import { daysBetween } from "@/lib/dates";

export interface RunwayRow {
  id: string;
  name: string;
  lastDate: string | null; // last scheduled workout on/after today
  daysLeft: number | null; // null = nothing scheduled
  urgency: "none" | "week" | "fortnight";
}

/**
 * clients: active clients with programming switched on
 * workouts: upcoming workouts (date >= today) — athlete_id or group_id set
 * members: group memberships
 * Returns only clients who run out within 14 days (or have nothing), most urgent first.
 */
export function programRunway(
  today: string,
  clients: { id: string; name: string }[],
  workouts: { athlete_id: string | null; group_id: string | null; workout_date: string }[],
  members: { group_id: string; athlete_id: string }[],
): RunwayRow[] {
  const groupLast = new Map<string, string>();
  const athleteLast = new Map<string, string>();
  for (const w of workouts) {
    if (w.workout_date < today) continue;
    const map = w.athlete_id ? athleteLast : groupLast;
    const key = (w.athlete_id ?? w.group_id)!;
    if (!map.has(key) || map.get(key)! < w.workout_date) map.set(key, w.workout_date);
  }
  for (const m of members) {
    const g = groupLast.get(m.group_id);
    if (g && (!athleteLast.has(m.athlete_id) || athleteLast.get(m.athlete_id)! < g))
      athleteLast.set(m.athlete_id, g);
  }
  return clients
    .map((c): RunwayRow => {
      const last = athleteLast.get(c.id) ?? null;
      const daysLeft = last ? daysBetween(today, last) : null;
      const urgency =
        daysLeft === null ? "none" : daysLeft < 7 ? "week" : daysLeft < 14 ? "fortnight" : ("ok" as never);
      return { id: c.id, name: c.name, lastDate: last, daysLeft, urgency };
    })
    .filter((r) => r.daysLeft === null || r.daysLeft < 14)
    .sort((a, b) => (a.daysLeft ?? -1) - (b.daysLeft ?? -1) || a.name.localeCompare(b.name));
}
