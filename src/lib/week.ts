// Monday–Sunday weeks in Sydney time. Mirrors week_monday() / editable_from() in SQL.
import { daysBetween, isISODate } from "./dates";

export const EDITABLE_PAST_WEEKS = 3; // current week + 3 previous

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export { addDays };

/** Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
  const dow = new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = Sun
  return addDays(iso, -((dow + 6) % 7));
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function editableFrom(todayISO: string): string {
  return addDays(mondayOf(todayISO), -7 * EDITABLE_PAST_WEEKS);
}

/** Weeks an athlete may open, newest first. */
export function editableWeeks(todayISO: string): string[] {
  const cur = mondayOf(todayISO);
  return Array.from({ length: EDITABLE_PAST_WEEKS + 1 }, (_, i) =>
    addDays(cur, -7 * i),
  );
}

export function isEditableWeek(monday: string, todayISO: string): boolean {
  return (
    isISODate(monday) &&
    mondayOf(monday) === monday &&
    editableWeeks(todayISO).includes(monday)
  );
}

export function isLoggableDate(iso: string, todayISO: string): boolean {
  return isISODate(iso) && iso <= todayISO && iso >= editableFrom(todayISO);
}

const DAY = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  timeZone: "UTC",
});
const DAYNUM = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "Mon" */
export function dayShort(iso: string) {
  return DAY.format(new Date(iso + "T00:00:00Z"));
}
/** "9 Nov" */
export function dayMonth(iso: string) {
  return DAYNUM.format(new Date(iso + "T00:00:00Z"));
}

/** "This week" / "Last week" / "3–9 Nov" */
export function weekLabel(monday: string, todayISO: string): string {
  const diff = daysBetween(monday, mondayOf(todayISO)) / 7;
  if (diff === 0) return "This week";
  if (diff === 1) return "Last week";
  return `${dayMonth(monday)} – ${dayMonth(addDays(monday, 6))}`;
}

/** "6:30 pm" from "18:30" or "18:30:00" */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
