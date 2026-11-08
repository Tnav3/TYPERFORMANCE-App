import { daysBetween } from "./dates";

/** "Fight in 6w 3d" style countdown. Null if no date or already passed. */
export function fightCountdown(fightISO: string | null, todayISO: string) {
  if (!fightISO) return null;
  const days = daysBetween(todayISO, fightISO);
  if (days < 0)
    return { days, label: "Fight date passed — update it", past: true };
  if (days === 0) return { days, label: "Fight day", past: false };
  const w = Math.floor(days / 7);
  const d = days % 7;
  const label =
    w === 0
      ? `${d} day${d === 1 ? "" : "s"} out`
      : `${w}w${d ? ` ${d}d` : ""} out`;
  return { days, label, past: false };
}
