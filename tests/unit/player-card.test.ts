import { describe, it, expect } from "vitest";
import { playerCard, standardRating } from "@/lib/player-card";

describe("player card", () => {
  const s = { bronze: 1.5, silver: 2, gold: 2.5 };
  it("rates against standards", () => {
    expect(standardRating(1.5, s)).toBe(70);
    expect(standardRating(2, s)).toBe(80);
    expect(standardRating(2.5, s)).toBe(90);
    expect(standardRating(2.25, s)).toBe(85);
    expect(standardRating(0.75, s)).toBeGreaterThanOrEqual(50);
    expect(standardRating(3.5, s)).toBe(99);
  });
  it("handles lower-is-better (times)", () => {
    const t = { bronze: 60, silver: 50, gold: 40 };
    expect(standardRating(50, t)).toBe(80);
    expect(standardRating(70, t)!).toBeLessThan(70);
  });
  it("builds a card and tier", () => {
    const c = playerCard({ tests: [{ group: "strength", rating: 82 }, { group: "strength", rating: 78 }, { group: "power", rating: null }], completionPct: 90, streakWeeks: 4, pbs: 6, sessions: 40 });
    expect(c.stats.str).toBe(80);
    expect(c.stats.pwr).toBeNull();
    expect(c.stats.con).toBe(93);
    expect(c.overall).not.toBeNull();
    expect(["silver", "gold"]).toContain(c.tier);
    expect(playerCard({ tests: [], completionPct: null, streakWeeks: 0, pbs: 0, sessions: 0 }).tier).toBe("rookie");
  });
});
