// The business runs on Sydney time. Servers (Vercel) run on UTC, so
// "today" must be worked out explicitly or dates drift by a day.
export const APP_TIMEZONE = "Australia/Sydney";

/** Today's date as YYYY-MM-DD in Sydney time. */
export function todayISO(
  now: Date = new Date(),
  tz: string = APP_TIMEZONE,
): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole days from `fromISO` to `toISO` (both YYYY-MM-DD). Negative if in the past. */
export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.UTC(
    +fromISO.slice(0, 4),
    +fromISO.slice(5, 7) - 1,
    +fromISO.slice(8, 10),
  );
  const b = Date.UTC(
    +toISO.slice(0, 4),
    +toISO.slice(5, 7) - 1,
    +toISO.slice(8, 10),
  );
  return Math.round((b - a) / 86_400_000);
}

export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** "12 Mar 2027" */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso + "T00:00:00Z"));
}
