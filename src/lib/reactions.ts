// Coach reactions on a finished session (migration 097). Pure, shared by UI + actions.
export const REACTIONS = ["👍", "🔥", "💪", "👏"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const isReaction = (v: unknown): v is Reaction => typeof v === "string" && (REACTIONS as readonly string[]).includes(v);

/** "Re: Upper Strength (Tue 24 Nov): Great work" — keeps the chat reply tied to the session. */
export function replyBody(title: string | null | undefined, dateLabel: string, text: string): string {
  const head = `Re: ${(title ?? "your session").slice(0, 60)} (${dateLabel}): `;
  return (head + text.trim()).slice(0, 2000);
}

/** Short "2 h ago" style label for recent activity. */
export function ago(iso: string, now: Date): string {
  const m = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
