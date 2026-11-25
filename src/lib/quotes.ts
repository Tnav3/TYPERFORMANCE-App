// Same quote for everyone on a given day; rotates through the active list. Pure, unit-tested.
export function quoteOfDay<T extends { id: string }>(quotes: T[], todayISO: string): T | null {
  if (!quotes.length) return null;
  const sorted = [...quotes].sort((a, b) => a.id.localeCompare(b.id));
  const day = Math.floor(Date.parse(`${todayISO}T00:00:00Z`) / 86_400_000);
  return sorted[day % sorted.length];
}
