import { describe, it, expect } from "vitest";
import { quoteOfDay } from "@/lib/quotes";

describe("quote of the day", () => {
  const qs = [{ id: "b" }, { id: "a" }, { id: "c" }];
  it("is stable for a day and rotates", () => {
    const d1 = quoteOfDay(qs, "2026-11-25")!.id;
    expect(quoteOfDay([...qs].reverse(), "2026-11-25")!.id).toBe(d1);
    const week = ["2026-11-25", "2026-11-26", "2026-11-27"].map((d) => quoteOfDay(qs, d)!.id);
    expect(new Set(week).size).toBe(3);
    expect(quoteOfDay([], "2026-11-25")).toBeNull();
  });
});
