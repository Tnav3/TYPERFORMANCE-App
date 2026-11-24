import { describe, it, expect } from "vitest";
import { change, defaultWidgets, lastWeeks, strengthTrend, weeklyCompliance, weeklyVolume } from "@/lib/programming/widgets";

describe("client widgets", () => {
  const weeks = lastWeeks("2026-11-25", 3); // Mondays 9, 16, 23 Nov
  it("lists the last Mondays oldest first", () => {
    expect(weeks).toEqual(["2026-11-09", "2026-11-16", "2026-11-23"]);
  });
  it("sums kg × reps per week", () => {
    const v = weeklyVolume(
      [
        { date: "2026-11-10", reps: 5, kg: 100, value: null },
        { date: "2026-11-15", reps: 5, kg: 100, value: null },
        { date: "2026-11-24", reps: 10, kg: 20, value: null },
      ],
      weeks,
    );
    expect(v.map((p) => p.value)).toEqual([1000, 0, 200]);
  });
  it("tracks the most-trained lift's best e1RM", () => {
    const s = strengthTrend(
      [
        { key: "sq", date: "2026-11-10", reps: 5, kg: 100, value: null },
        { key: "sq", date: "2026-11-24", reps: 5, kg: 105, value: null },
        { key: "sq", date: "2026-11-24", reps: 3, kg: 100, value: null },
        { key: "bp", date: "2026-11-24", reps: 5, kg: 80, value: null },
      ],
      weeks,
    );
    expect(s.key).toBe("sq");
    expect(s.points[1].value).toBeNull();
    expect(s.points[2].value).toBeGreaterThan(s.points[0].value!);
  });
  it("compliance caps at 100% and skips empty weeks", () => {
    expect(weeklyCompliance(["2026-11-10", "2026-11-12"], ["2026-11-10", "2026-11-12", "2026-11-13"], weeks).map((p) => p.value)).toEqual([100, null, null]);
  });
  it("change compares first and latest values", () => {
    expect(change([{ label: "a", value: 80 }, { label: "b", value: null }, { label: "c", value: 78 }])).toEqual({ latest: 78, diff: -2, pct: -2.5 });
    expect(change([{ label: "a", value: null }])).toEqual({ latest: null, diff: null, pct: null });
  });
  it("picks sensible defaults", () => {
    expect(defaultWidgets({ fighter: true, bodyweight: true })[0]).toBe("volume");
    expect(defaultWidgets({ fighter: false, bodyweight: true })[0]).toBe("bodyweight");
  });
});

import { trendMessage } from "@/lib/programming/widgets";
describe("trend message", () => {
  it("says how far a lift moved", () => {
    expect(trendMessage("Squat", "line", [{ label: "a", value: null }, { label: "b", value: 100 }, { label: "c", value: null }, { label: "d", value: 107.5 }])).toBe("Squat up 7.5 kg in 2 weeks");
  });
  it("compares last full week for totals", () => {
    expect(trendMessage("Volume", "bars", [{ label: "a", value: 1000 }, { label: "b", value: 1100 }, { label: "c", value: 50 }])).toBe("Volume up 10% on the week before");
  });
  it("stays quiet without enough data", () => {
    expect(trendMessage("Bodyweight", "line", [{ label: "a", value: 80 }])).toBeNull();
  });
});
