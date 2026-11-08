import { describe, it, expect } from "vitest";
import {
  calculate,
  validateCalc,
  percentTable,
  velocityAt,
  roundTo2_5,
  latestMaxes,
  groupLifts,
  slugify,
  type Lift,
} from "@/lib/calculator";

describe("e1RM", () => {
  it("1 rep = the load itself", () => {
    expect(calculate({ kind: "barbell", load: 140, reps: 1 }).e1rm).toBe(140);
  });
  it("averages Epley and Brzycki (100 kg × 5 → 114 kg)", () => {
    // Epley 116.67, Brzycki 112.5 → 114.58 → nearest 0.5 = 114.5
    expect(calculate({ kind: "barbell", load: 100, reps: 5 }).e1rm).toBe(114.5);
  });
  it("weighted chin-up uses system mass (spec example 75 BW + 20 × 5)", () => {
    const r = calculate({ kind: "bodyweight", load: 20, reps: 5, bodyweight: 75 });
    expect(r.e1rm).toBe(109); // system mass, spec says ≈110
    expect(r.addedMax).toBe(34); // spec says ~35
  });
  it("flags reps above 5, and Olympic lifts above 3", () => {
    expect(calculate({ kind: "barbell", load: 100, reps: 5 }).warnings).toEqual([]);
    expect(calculate({ kind: "barbell", load: 100, reps: 6 }).warnings).toHaveLength(1);
    expect(calculate({ kind: "olympic", load: 80, reps: 3 }).warnings).toEqual([]);
    expect(calculate({ kind: "olympic", load: 80, reps: 4 }).warnings[0]).toMatch(/Olympic/);
  });
});

describe("validation", () => {
  it("caps reps at 10 and rejects 0 / decimals", () => {
    expect(validateCalc({ kind: "barbell", load: 100, reps: 11 }).reps).toBeTruthy();
    expect(validateCalc({ kind: "barbell", load: 100, reps: 0 }).reps).toBeTruthy();
    expect(validateCalc({ kind: "barbell", load: 100, reps: 2.5 }).reps).toBeTruthy();
    expect(validateCalc({ kind: "barbell", load: 100, reps: 10 })).toEqual({});
  });
  it("bodyweight lifts need bodyweight; 0 kg added is allowed", () => {
    expect(validateCalc({ kind: "bodyweight", load: 0, reps: 8 }).bodyweight).toBeTruthy();
    expect(validateCalc({ kind: "bodyweight", load: 0, reps: 8, bodyweight: 70 })).toEqual({});
  });
  it("jumps can't be calculated directly", () => {
    expect(validateCalc({ kind: "jump", load: 60, reps: 1 }).lift).toBeTruthy();
  });
});

describe("percentage table", () => {
  it("rounds to the nearest 2.5 kg, 100 → 50 %", () => {
    const t = percentTable({ e1rm: 143, kind: "barbell" });
    expect(t.map((r) => r.pct)).toEqual([100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]);
    expect(t[0].load).toBe(142.5);
    expect(t.at(-1)!.load).toBe(72.5);
    for (const r of t) expect(r.load % 2.5).toBe(0);
  });
  it("bodyweight lifts show added load (can go to bodyweight only)", () => {
    const t = percentTable({ e1rm: 109, kind: "bodyweight", bodyweight: 75 });
    expect(t[0].added).toBe(35); // 109 − 75 = 34 → 35 (nearest 2.5)
    const fifty = t.find((r) => r.pct === 50)!;
    expect(fifty.added).toBeLessThanOrEqual(0);
  });
  it("Smith bench throw: % of bench e1RM, plates per side from the athlete's bar", () => {
    const t = percentTable({ e1rm: 120, kind: "jump", barWeight: 15 });
    const forty = t.find((r) => r.pct === 40)!;
    expect(forty.load).toBe(47.5);
    expect(forty.perSide).toBe(16.25);
    // bar heavier than the load → 0 per side, never negative
    expect(t.find((r) => r.pct === 10)!.perSide).toBe(0);
  });
  it("roundTo2_5", () => {
    expect(roundTo2_5(101.2)).toBe(100);
    expect(roundTo2_5(101.3)).toBe(102.5);
  });
});

describe("bar-speed guide", () => {
  it("bench ≈0.18 m/s at 1RM and rises as load drops", () => {
    expect(velocityAt("bench", 100)).toBe(0.18);
    expect(velocityAt("bench", 70)).toBeCloseTo(0.62, 2);
    expect(velocityAt("bench", 50)).toBeGreaterThan(velocityAt("bench", 70)!);
  });
  it("deadlift from Benavides-Ubric 2020", () => {
    expect(velocityAt("deadlift", 100)).toBe(0.31);
    expect(velocityAt("deadlift", 50)).toBe(0.93);
  });
  it("squat only shows verified anchors, blank elsewhere", () => {
    expect(velocityAt("squat", 100)).toBe(0.32);
    expect(velocityAt("squat", 80)).toBe(0.67);
    expect(velocityAt("squat", 70)).toBe(0.8);
    expect(velocityAt("squat", 90)).toBeNull();
    expect(velocityAt("squat", 50)).toBeNull();
  });
  it("is monotonic for bench and deadlift across 50–100 %", () => {
    for (const m of ["bench", "deadlift"] as const) {
      let prev = Infinity;
      for (let p = 50; p <= 100; p += 5) {
        const v = velocityAt(m, p)!;
        expect(v).toBeLessThan(prev);
        prev = v;
      }
    }
  });
});

describe("helpers", () => {
  it("latestMaxes keeps the newest per lift", () => {
    const r = latestMaxes([
      { lift_key: "bench", created_at: "2026-01-01", e: 100 },
      { lift_key: "bench", created_at: "2026-03-01", e: 110 },
      { lift_key: "deadlift", created_at: "2026-02-01", e: 180 },
    ]);
    expect(r.bench.e).toBe(110);
    expect(r.deadlift.e).toBe(180);
  });
  it("groups in spec order and sorts within", () => {
    const mk = (key: string, category: Lift["category"], sort_order: number): Lift => ({
      key, name: key, category, kind: "barbell", per_leg: false, parent_key: null,
      bar_weight_input: false, velocity_model: null, sort_order, active: true,
    });
    const g = groupLifts([mk("b", "press", 2), mk("a", "squat", 1), mk("c", "press", 1)]);
    expect(g.map((x) => x.category)).toEqual(["squat", "press"]);
    expect(g[1].lifts.map((l) => l.key)).toEqual(["c", "b"]);
  });
  it("slugify", () => {
    expect(slugify("Paused Back Squat (3s)")).toBe("paused_back_squat_3s");
  });
});
