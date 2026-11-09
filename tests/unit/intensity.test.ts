import { describe, it, expect } from "vitest";
import { pctFor, e1rmFromRpe, hrZones, tanakaHrMax, bpmAt, validateHr, RPE_COLUMNS, REP_ROWS } from "@/lib/intensity";

describe("RTS %1RM chart", () => {
  it("matches the published cells", () => {
    expect(pctFor(1, 10)).toBe(100);
    expect(pctFor(5, 10)).toBe(86.3);
    expect(pctFor(2, 8.5)).toBe(90.7);
    expect(pctFor(3, 6)).toBe(81.1);
    expect(pctFor(4, 7.5)).toBe(82.4);
    expect(pctFor(9, 9.5)).toBe(75.1);
    expect(pctFor(10, 10)).toBe(73.9);
  });
  it("3 @ RPE 10 equals 1 @ RPE 8", () => expect(pctFor(3, 10)).toBe(pctFor(1, 8)));
  it("is blank past 10 reps to failure and for invalid input", () => {
    expect(pctFor(9, 9)).toBe(73.9); // = 10 to failure, still shown
    expect(pctFor(9, 8.5)).toBeNull(); // 10.5 to failure
    expect(pctFor(0, 10)).toBeNull();
    expect(pctFor(3, 8.3)).toBeNull();
  });
  it("drops as reps or RIR go up", () => {
    for (const r of REP_ROWS) {
      let prev = Infinity;
      for (const rpe of RPE_COLUMNS) {
        const p = pctFor(r, rpe);
        if (p == null) continue;
        expect(p).toBeLessThan(prev);
        prev = p;
      }
    }
  });
  it("estimates 1RM from a set at an RPE", () => {
    expect(e1rmFromRpe(100, 5, 8)).toBe(123.5); // 5 reps + 2 RIR = 7 to failure = 81.1 %; 100 / 0.811 = 123.3 → 123.5
    expect(e1rmFromRpe(100, 9, 8)).toBeNull();
  });
});

describe("heart-rate zones", () => {
  it("Tanaka HRmax", () => {
    expect(tanakaHrMax(30)).toBe(187);
    expect(tanakaHrMax(20)).toBe(194);
  });
  it("uses %HRmax without resting HR", () => {
    const z = hrZones(190);
    expect(z[2].pct).toEqual([64, 76]);
    expect(z[2].bpm).toEqual([122, 144]);
    expect(z[0].bpm[0]).toBeNull();
    expect(z[4].bpm[1]).toBe(190);
  });
  it("uses Karvonen (%HRR) with resting HR", () => {
    const z = hrZones(190, 60);
    expect(z[3].pct).toEqual([60, 89]);
    expect(z[3].bpm).toEqual([138, 176]); // 60 + .6*130 = 138; 60 + .89*130 = 175.7
    expect(bpmAt(100, 190, 60)).toBe(190);
  });
  it("validates inputs", () => {
    expect(validateHr({ age: 30 })).toEqual({});
    expect(validateHr({ hrMax: 195, rest: 52 })).toEqual({});
    expect(validateHr({})).toHaveProperty("age");
    expect(validateHr({ hrMax: 300 })).toHaveProperty("hrMax");
    expect(validateHr({ age: 30, rest: 20 })).toHaveProperty("rest");
  });
});

import { HR_BANDS } from "@/lib/intensity";
describe("HR zones use the modified Borg 0–10 scale", () => {
  it("matches ACSM for moderate (3–4) and vigorous (5–7), rising through the zones", () => {
    expect(HR_BANDS.map((b) => b.rpe)).toEqual(["1", "2", "3–4", "5–7", "8–10"]);
  });
});
