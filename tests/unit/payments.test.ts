import { describe, it, expect } from "vitest";
import { cleanEmail, decide, planOf, safeEqual } from "@/lib/programming/payments";

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
