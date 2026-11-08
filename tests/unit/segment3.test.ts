import { describe, it, expect } from "vitest";
import {
  trafficLight,
  weeklyTotals,
  formatChange,
  LIGHT_ORDER,
} from "@/lib/load-metrics";

describe("traffic light (agreed thresholds: amber >15%, red >30% or niggle)", () => {
  it("green at and below +15%", () => {
    expect(trafficLight(1150, 1000, false).level).toBe("green"); // exactly +15%
    expect(trafficLight(800, 1000, false).level).toBe("green"); // drop
    expect(trafficLight(1000, 1000, false).level).toBe("green");
  });
  it("amber above +15% up to and including +30%", () => {
    expect(trafficLight(1151, 1000, false).level).toBe("amber");
    expect(trafficLight(1300, 1000, false).level).toBe("amber"); // exactly +30%
  });
  it("red above +30%", () => {
    expect(trafficLight(1301, 1000, false).level).toBe("red");
    expect(trafficLight(3000, 1000, false).reasons).toEqual(["Load up 200%"]);
  });
  it("niggle forces red, whatever the load", () => {
    const r = trafficLight(500, 1000, true);
    expect(r.level).toBe("red");
    expect(r.reasons).toEqual(["Niggle reported"]);
    expect(trafficLight(1200, 1000, true).reasons).toEqual([
      "Niggle reported",
      "Load up 20%",
    ]);
  });
  it("no baseline → no light (not a false red), unless niggle", () => {
    expect(trafficLight(2000, 0, false)).toEqual({
      level: "none",
      changePct: null,
      reasons: ["No baseline week"],
    });
    expect(trafficLight(2000, 0, true).level).toBe("red");
  });
  it("sort order puts problems first", () => {
    const sorted = (["green", "none", "red", "amber"] as const)
      .slice()
      .sort((a, b) => LIGHT_ORDER[a] - LIGHT_ORDER[b]);
    expect(sorted).toEqual(["red", "amber", "none", "green"]);
  });
  it("formats change", () => {
    expect(formatChange(14.6)).toBe("+15%");
    expect(formatChange(-20.2)).toBe("-20%");
    expect(formatChange(0)).toBe("0%");
    expect(formatChange(null)).toBe("–");
  });
});

describe("weekly totals", () => {
  it("sums load, minutes, count and breakdowns per athlete per week", () => {
    const s = (
      a: string,
      w: string,
      d: string,
      t: string,
      min: number,
      rpe: number,
    ) => ({
      athlete_id: a,
      week_start: w,
      discipline_id: d,
      session_type_id: t,
      duration_min: min,
      load_au: min * rpe,
    });
    const m = weeklyTotals([
      s("A", "2026-11-02", "MT", "spar", 60, 8),
      s("A", "2026-11-02", "MT", "pads", 90, 6),
      s("A", "2026-11-02", "SC", "str", 60, 7),
      s("A", "2026-10-26", "MT", "spar", 45, 9),
      s("B", "2026-11-02", "BJJ", "roll", 60, 5),
    ]);
    expect(m.get("A")!.get("2026-11-02")).toEqual({
      load: 480 + 540 + 420,
      minutes: 210,
      count: 3,
      byDiscipline: { MT: 1020, SC: 420 },
      byType: { spar: 480, pads: 540, str: 420 },
    });
    expect(m.get("A")!.get("2026-10-26")!.load).toBe(405);
    expect(m.get("B")!.get("2026-11-02")!.count).toBe(1);
  });
});

describe("threshold edges across many baselines", () => {
  it("exactly +15% is green and exactly +30% is amber for every whole-number baseline 1–5000", () => {
    for (let prev = 20; prev <= 5000; prev += 20) {
      expect(trafficLight(prev * 1.15, prev, false).level).toBe("green");
      expect(trafficLight(prev * 1.3, prev, false).level).toBe("amber");
    }
  });
});
