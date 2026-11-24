import { describe, it, expect } from "vitest";
import { habitBadges, habitStats, streak } from "@/lib/programming/habits";

describe("habit gamification", () => {
  it("streak counts back from today, or yesterday if today is open", () => {
    expect(streak(new Set(["2026-11-24", "2026-11-23", "2026-11-21"]), "2026-11-24")).toBe(2);
    expect(streak(new Set(["2026-11-23", "2026-11-22"]), "2026-11-24")).toBe(2);
    expect(streak(new Set(["2026-11-20"]), "2026-11-24")).toBe(0);
  });
  it("perfect days, weekly score and badges", () => {
    const today = "2026-11-25"; // Wed; week started Mon 23rd
    const logs = [
      ...["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25"].map((day) => ({ habit_id: "a", day })),
      ...["2026-11-23", "2026-11-24", "2026-11-25"].map((day) => ({ habit_id: "b", day })),
    ];
    const s = habitStats(["a", "b"], logs, today);
    expect(s.perHabit.get("a")).toBe(7);
    expect(s.perfectToday).toBe(true);
    expect(s.perfectStreak).toBe(3);
    expect(s.weekScore).toBe(100);
    expect(s.perfectDaysThisWeek).toBe(3);
    expect(habitBadges(s).map((b) => b.key)).toEqual(["habit_streak_7", "perfect_3"]);
  });
});
