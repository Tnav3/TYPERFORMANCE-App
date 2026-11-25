import { describe, it, expect } from "vitest";
import { cabinet, fightBadges, tracks } from "@/lib/trophies";

describe("trophy cabinet", () => {
  it("counts earned and shows progress to the next", () => {
    const c = cabinet(tracks({ workouts: 18, pbs: 3, fights: 2, wins: 1 }), new Set(["workouts_1", "workouts_10", "pbs_1", "fights_1", "wins_1"]));
    const w = c.views.find((v) => v.track.key === "workouts")!;
    expect(w.earned).toBe(2);
    expect(w.next).toEqual({ label: "25", at: 25, have: 18, pct: 72 });
    expect(c.views.find((v) => v.track.key === "streak")!.next!.pct).toBeNull();
    expect(c.earned).toBe(5);
  });
  it("awards fight badges", () => {
    expect(fightBadges(5, 1).map((b) => b.key)).toEqual(["fights_1", "fights_5", "wins_1"]);
  });
});
