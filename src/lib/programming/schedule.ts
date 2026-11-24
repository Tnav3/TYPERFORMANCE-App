// Sydney wall-clock time → UTC instant, and human labels for schedules.

/** Minutes Sydney is ahead of UTC at a given instant (600 or 660). */
function sydneyOffsetMin(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Sydney",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - Math.floor(utcMs / 60000) * 60000) / 60000);
}

/** "2026-11-29", "18:00" (Sydney) → ISO UTC string. */
export function sydneyToUtc(date: string, time: string): string | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = time.match(/^(\d{2}):(\d{2})$/);
  if (!m || !t) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  let guess = naive - sydneyOffsetMin(naive) * 60000;
  guess = naive - sydneyOffsetMin(guess) * 60000; // settle across DST changes
  return new Date(guess).toISOString();
}

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function scheduleLabel(s: {
  repeat: string;
  weekdays: number[] | null;
  every_days: number | null;
  time_of_day: string;
}): string {
  const [h, mi] = s.time_of_day.split(":").map(Number);
  const t = `${((h + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  if (s.repeat === "weekly") {
    const d = [...(s.weekdays ?? [])].sort();
    const days = d.length === 7 ? "Every day" : d.join() === "1,2,3,4,5" ? "Weekdays" : d.map((x) => DAYS[x]).join(", ");
    return `${days} at ${t}`;
  }
  if (s.repeat === "days") return `Every ${s.every_days === 1 ? "day" : `${s.every_days} days`} at ${t}`;
  return "Once";
}
