import { describe, it, expect } from "vitest";
import { cleanEmail, decide, matchProduct, planOf, safeEqual } from "@/lib/programming/payments";

describe("GHL payments", () => {
  it("maps events", () => {
    expect(decide("Payment Received", "TYP Premium Coaching")).toEqual({ kind: "activate", plan: "premium" });
    expect(decide("subscription-cancelled", null)).toEqual({ kind: "deactivate" });
    expect(decide("payment_failed", "basic")).toEqual({ kind: "deactivate" });
    expect(decide("contact_created", null).kind).toBe("ignore");
  });
  it("plans and emails", () => {
    expect(planOf("Online Coaching - Basic")).toBe("basic");
    expect(planOf("")).toBeNull();
    expect(cleanEmail("  Alice@Example.com ")).toBe("alice@example.com");
    expect(cleanEmail("nope")).toBeNull();
  });
  it("secret compare", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("", "")).toBe(false);
  });
});

import { matchPlanKey } from "@/lib/programming/payments";
describe("matchPlanKey", () => {
  const plans = [
    { key: "foundation", name: "Foundation" },
    { key: "performance", name: "Performance" },
    { key: "elite", name: "Elite" },
    { key: "one_on_one", name: "1-on-1 (in person)" },
    { key: "semi_private", name: "Semi-private group" },
  ];
  it("matches keys, names and product titles that contain a plan name", () => {
    expect(matchPlanKey("elite", plans)).toBe("elite");
    expect(matchPlanKey("Semi-Private Group", plans)).toBe("semi_private");
    expect(matchPlanKey("TYPERFORMANCE Performance Coaching - Monthly", plans)).toBe("performance");
    expect(matchPlanKey("1-on-1 (in person)", plans)).toBe("one_on_one");
    expect(matchPlanKey("Gift card", plans)).toBeNull();
    expect(matchPlanKey("", plans)).toBeNull();
  });
});

describe("matchProduct", () => {
  const products = [
    { id: "p1", slug: "power-puncher", title: "Power Puncher Program", match_name: "Power Puncher (8 wk)" },
    { id: "p2", slug: "base-builder-novice", title: "Base Builder - Novice", match_name: null },
  ];
  it("matches the MxP name, title or slug exactly", () => {
    expect(matchProduct("power puncher (8 WK)", products)).toBe("p1");
    expect(matchProduct("Power Puncher Program", products)).toBe("p1");
    expect(matchProduct("base-builder-novice", products)).toBe("p2");
  });
  it("never guesses", () => {
    expect(matchProduct("Power", products)).toBeNull();
    expect(matchProduct("Online Performance Coaching", products)).toBeNull();
    expect(matchProduct(null, products)).toBeNull();
  });
});
