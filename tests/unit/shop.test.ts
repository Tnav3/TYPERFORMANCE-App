import { describe, expect, it } from "vitest";
import { parsePrice, priceLabel, slugify, totalCents } from "@/lib/shop";

describe("shop helpers", () => {
  it("labels prices", () => {
    expect(priceLabel(1499, "AUD", "weekly", 8)).toBe("$14.99 AUD a week for 8 weeks");
    expect(priceLabel(9900, "AUD", "once", null)).toBe("$99 AUD");
    expect(priceLabel(2999, "AUD", "monthly", null)).toBe("$29.99 AUD a month");
    expect(priceLabel(500, "USD", "monthly", 1)).toBe("$5 USD a month for 1 month");
  });
  it("totals", () => {
    expect(totalCents(1499, "weekly", 8)).toBe(11992);
    expect(totalCents(9900, "once", null)).toBe(9900);
    expect(totalCents(2999, "monthly", null)).toBeNull();
  });
  it("slugs and prices", () => {
    expect(slugify("Base Builder - Novice")).toBe("base-builder-novice");
    expect(slugify("!!!")).toBe("program");
    expect(parsePrice("$14.99")).toBe(1499);
    expect(parsePrice("15")).toBe(1500);
    expect(parsePrice("14,5")).toBe(1450);
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("-3")).toBeNull();
  });
});
