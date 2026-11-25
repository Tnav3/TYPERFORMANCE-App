// AU product database helpers (pure, unit-tested).
const r1 = (n: number) => Math.round(n * 10) / 10;

/** "150 g" for weights; small serve sizes are counts (2 slices, 1 egg). */
export function amountText(p: { serve: number | null }, qty: number) {
  const s = p.serve ?? 0;
  if (s > 10) return `${r1(s * qty)} g`;
  const count = r1((s || 1) * qty);
  return `${count} ${count === 1 ? "serve" : "serves"}`;
}

/** True when the database row's figures aren't straight off a label. */
export const isEstimate = (verified: string | null | undefined) => /estimate|partial/i.test(verified ?? "") || !verified;
