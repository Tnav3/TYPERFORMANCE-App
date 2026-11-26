import { describe, it, expect } from "vitest";
import { isStale, latestDates, repMaxEquivalent, weeksSince } from "@/lib/programming/stale-max";

describe("stale maxes", () => {
  it("counts whole weeks and applies the cut-off", () => {
    expect(weeksSince("2026-09-01", "2026-10-27")).toBe(8);
    expect(isStale("2026-09-01", "2026-10-27", 8)).toBe(true);
    expect(isStale("2026-09-02", "2026-10-27", 8)).toBe(false);
    expect(isStale(null, "2026-10-27", 8)).toBe(false);
  });
  it("keeps the newest date per lift", () => {
    const m = latestDates([{ lift_key: "a", saved_on: "2026-10-01" }, { lift_key: "a", saved_on: "2026-01-01" }]);
    expect(m.get("a")).toBe("2026-10-01");
  });
  it("turns reps @ RPE into a rep max", () => {
    expect(repMaxEquivalent(5, 8)).toBe(7);
    expect(repMaxEquivalent(3, 8.5)).toBe(4);
    expect(repMaxEquivalent(1, 10)).toBe(1);
    expect(repMaxEquivalent(8, 6)).toBeNull();
    expect(repMaxEquivalent(5, 5)).toBeNull();
  });
});
