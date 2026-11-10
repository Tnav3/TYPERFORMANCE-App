// "Last opened the app" for the coach dashboard. Pure: unit-tested.

const DAY = 86_400_000;

/** Stamp at most once an hour, so page loads stay fast. */
export const shouldTouch = (lastSeen: string | null | undefined, now: Date) =>
  !lastSeen || now.getTime() - new Date(lastSeen).getTime() > 3_600_000;

/** Calendar days in Sydney between two instants (0 = same day). */
function sydneyDaysBetween(a: Date, b: Date) {
  const d = (x: Date) =>
    new Date(x.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
  const day = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.round((day(d(b)) - day(d(a))) / DAY);
}

export function lastSeenLabel(iso: string | null | undefined, now: Date) {
  if (!iso) return "Never";
  const n = sydneyDaysBetween(new Date(iso), now);
  if (n <= 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.floor(n / 7)} weeks ago`;
  return `${Math.floor(n / 30)} months ago`;
}

export type ActivityTone = "ok" | "warn" | "bad";
export function activityTone(
  iso: string | null | undefined,
  now: Date,
): ActivityTone {
  if (!iso) return "bad";
  const n = sydneyDaysBetween(new Date(iso), now);
  return n <= 7 ? "ok" : n <= 21 ? "warn" : "bad";
}

/** Least recent first (never-opened at the top), so non-users stand out. */
export function byLeastRecent<T extends { last_seen_at: string | null }>(
  rows: T[],
) {
  return [...rows].sort((a, b) =>
    !a.last_seen_at
      ? -1
      : !b.last_seen_at
        ? 1
        : a.last_seen_at.localeCompare(b.last_seen_at),
  );
}
