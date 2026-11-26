// Returning to a lift after a break: when the saved e1RM is older than the coach's
// cut-off, % loads use a cautious estimate and the client builds to an RPE top set.
export const STALE_FACTOR = 0.9;
export const DEFAULT_STALE_WEEKS = 8;

export function weeksSince(savedOn: string, today: string): number {
  return Math.floor((Date.parse(today) - Date.parse(savedOn)) / (7 * 86400000));
}

export function isStale(savedOn: string | null | undefined, today: string, staleWeeks: number): boolean {
  return !!savedOn && weeksSince(savedOn, today) >= staleWeeks;
}

/** Newest saved date per lift key. Expects maxes newest-first. */
export function latestDates(maxes: { lift_key: string; saved_on: string }[]) {
  const m = new Map<string, string>();
  for (const x of maxes) if (!m.has(x.lift_key)) m.set(x.lift_key, x.saved_on);
  return m;
}

/**
 * Reps a set at an RPE is worth as a rep max: 5 @ RPE 8 ≈ 7RM (reps in reserve added).
 * Half RPEs round down (cautious). Null if the RPE is outside 6–10 or it adds up past 10.
 */
export function repMaxEquivalent(reps: number, rpe: number): number | null {
  if (!Number.isInteger(reps) || reps < 1 || !(rpe >= 6 && rpe <= 10)) return null;
  const r = reps + Math.floor(10 - rpe);
  return r <= 10 ? r : null;
}
