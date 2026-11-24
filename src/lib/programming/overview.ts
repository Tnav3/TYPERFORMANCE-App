// Coach overview cards: pure calculations (unit-tested).

type W = { id: string; athlete_id: string | null; group_id: string | null; workout_date: string; overrides_id?: string | null };

/** Workouts each client was scheduled between from..to (own + group, minus group days they have a personal copy of). */
export function scheduledFor(
  workouts: W[],
  members: { group_id: string; athlete_id: string }[],
  from: string,
  to: string,
): Map<string, Set<string>> {
  const inRange = workouts.filter((w) => w.workout_date >= from && w.workout_date <= to);
  const overridden = new Set(inRange.filter((w) => w.overrides_id && w.athlete_id).map((w) => `${w.athlete_id}:${w.overrides_id}`));
  const byGroup = new Map<string, string[]>();
  for (const m of members) byGroup.set(m.group_id, [...(byGroup.get(m.group_id) ?? []), m.athlete_id]);
  const out = new Map<string, Set<string>>();
  const add = (a: string, id: string) => out.set(a, (out.get(a) ?? new Set()).add(id));
  for (const w of inRange) {
    if (w.athlete_id) add(w.athlete_id, w.id);
    else for (const a of byGroup.get(w.group_id!) ?? []) if (!overridden.has(`${a}:${w.id}`)) add(a, w.id);
  }
  return out;
}

/** Workout compliance per client: completed ÷ scheduled (null when nothing was scheduled). */
export function workoutCompliance(
  clients: string[],
  scheduled: Map<string, Set<string>>,
  completed: { athlete_id: string; workout_id: string }[],
) {
  const done = new Map<string, Set<string>>();
  for (const c of completed) done.set(c.athlete_id, (done.get(c.athlete_id) ?? new Set()).add(c.workout_id));
  const per = clients.map((id) => {
    const s = scheduled.get(id);
    if (!s?.size) return { id, pct: null as number | null, done: 0, total: 0 };
    const d = [...s].filter((w) => done.get(id)?.has(w)).length;
    return { id, pct: Math.round((d / s.size) * 100), done: d, total: s.size };
  });
  const rated = per.filter((p) => p.pct != null);
  const average = rated.length ? Math.round(rated.reduce((a, p) => a + p.pct!, 0) / rated.length) : null;
  return { per, average };
}

/** Programs expired: nothing scheduled from today, but something in the last `days` days. */
export function expiredClients(
  clients: string[],
  scheduledPast: Map<string, Set<string>>,
  hasFuture: Set<string>,
) {
  return clients.filter((c) => !hasFuture.has(c) && (scheduledPast.get(c)?.size ?? 0) > 0);
}

/** Sign-in summary from daily app opens over the last 7 days. */
export function signInSummary(clients: string[], opens: { athlete_id: string; opened_on: string }[]) {
  const days = new Map<string, number>();
  for (const o of opens) days.set(o.athlete_id, (days.get(o.athlete_id) ?? 0) + 1);
  const active = clients.filter((c) => (days.get(c) ?? 0) > 0).length;
  return {
    pctActive: clients.length ? Math.round((active / clients.length) * 100) : 0,
    avgDays: clients.length
      ? Math.round((clients.reduce((a, c) => a + (days.get(c) ?? 0), 0) / clients.length) * 10) / 10
      : 0,
  };
}

export const OVERVIEW_CARDS = [
  ["setup", "Incomplete setups"],
  ["checkins", "Missed check-ins"],
  ["inactive", "Inactive clients"],
  ["followups", "Follow-ups due"],
  ["pbs", "New personal bests"],
  ["expiring", "Programs expiring (red ≤ 7 days, amber ≤ 14)"],
  ["expired", "Programs expired"],
  ["compliance", "Compliance"],
  ["signin", "Average sign-in"],
] as const;
export type OverviewCard = (typeof OVERVIEW_CARDS)[number][0];
