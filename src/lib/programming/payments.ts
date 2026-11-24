// Maps a GoHighLevel payment event to what happens to the client's account.
// Pure (unit-tested). The API route applies it with the server-only key.

export type PaymentAction =
  | { kind: "activate"; plan: "basic" | "premium" | null }
  | { kind: "deactivate" }
  | { kind: "ignore"; reason: string };

const ACTIVATE = ["payment_received", "payment_succeeded", "order_completed", "subscription_created", "subscription_renewed", "invoice_paid"];
const DEACTIVATE = ["subscription_cancelled", "subscription_canceled", "payment_failed", "subscription_expired", "refund"];

export function planOf(raw: unknown): "basic" | "premium" | null {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return null;
  if (s.includes("premium") || s.includes("elite") || s.includes("vip")) return "premium";
  return "basic";
}

export function decide(eventRaw: unknown, planRaw: unknown): PaymentAction {
  const e = String(eventRaw ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (ACTIVATE.includes(e)) return { kind: "activate", plan: planOf(planRaw) };
  if (DEACTIVATE.includes(e)) return { kind: "deactivate" };
  return { kind: "ignore", reason: `Unknown event "${e || "(none)"}"` };
}

export function cleanEmail(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length <= 200 ? s : null;
}

/** Constant-time string compare for the shared secret. */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
