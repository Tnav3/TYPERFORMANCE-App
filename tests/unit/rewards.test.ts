import { describe, it, expect } from "vitest";
import { badgesFor, readinessScore, readinessTone, weeklyStreak } from "@/lib/programming/rewards";

describe("readiness", () => {
  it("scores 0–100 with soreness and stress reversed", () => {
    expect(readinessScore({ sleep: 5, energy: 5, soreness: 1, stress: 1, motivation: 5 })).toBe(100);
    expect(readinessScore({ sleep: 1, energy: 1, soreness: 5, stress: 5, motivation: 1 })).toBe(0);
    expect(readinessScore({ sleep: 3, energy: 3, soreness: 3, stress: 3, motivation: 3 })).toBe(50);
    expect(readinessTone(72)).toBe("ok");
    expect(readinessTone(49)).toBe("brand");
  });
});

describe("rewards", () => {
  it("milestone badges", () => {
    const keys = badgesFor({ workouts: 12, streakWeeks: 4, pbs: 1 }).map((b) => b.key);
    expect(keys).toEqual(["workouts_1", "workouts_10", "streak_2", "streak_4", "pbs_1"]);
  });
  it("weekly streak counts complete weeks back from the latest", () => {
    const today = "2026-11-25"; // Wed
    const sched = [
      { id: "a", date: "2026-11-09" }, // complete
      { id: "b", date: "2026-11-16" }, // complete
      { id: "c", date: "2026-11-18" }, // complete
      { id: "d", date: "2026-11-24" }, // this week, not done yet
      { id: "x", date: "2026-11-02" }, // missed → breaks the run
    ];
    expect(weeklyStreak(today, sched, new Set(["a", "b", "c"]))).toBe(2);
    expect(weeklyStreak(today, sched, new Set(["a", "b", "c", "d"]))).toBe(3);
  });
});
