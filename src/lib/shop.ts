// Program shop helpers (migration 098). Pure.
export type Billing = "once" | "weekly" | "monthly";

/** "$14.99 AUD a week for 8 weeks" · "$99 AUD" · "$29.99 AUD a month" */
export function priceLabel(cents: number, currency: string, billing: Billing, count: number | null): string {
  if (cents === 0) return "Free";
  const amt = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  const base = `$${amt} ${currency}`;
  if (billing === "once") return base;
  const unit = billing === "weekly" ? "week" : "month";
  return count ? `${base} a ${unit} for ${count} ${unit}${count === 1 ? "" : "s"}` : `${base} a ${unit}`;
}

/** Total paid over the whole run, for comparing products. Null when it runs until cancelled. */
export function totalCents(cents: number, billing: Billing, count: number | null): number | null {
  if (billing === "once") return cents;
  return count ? cents * count : null;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "program";
}

/** "$14.99" / "14,99" / "15" → cents; null if not a price. */
export function parsePrice(raw: unknown): number | null {
  const s = String(raw ?? "").trim().replace(/^\$/, "").replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
