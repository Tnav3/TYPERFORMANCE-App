import { describe, it, expect } from "vitest";
import { STANDARD_METRICS, levelOf, nextTarget, validateStandard, formatMetric, hasStandards, type Standard } from "@/lib/standards";

const s = (b: number | null, sv: number | null, g: number | null): Standard => ({ test_key: "x", sex: "male", bronze: b, silver: sv, gold: g, source: null });

describe("levels", () => {
  it("places a value at its level, at the boundary counts", () => {
    const st = s(1.0, 1.2, 1.5);
    expect(levelOf(0.9, st)).toBe("below");
    expect(levelOf(1.0, st)).toBe("bronze");
    expect(levelOf(1.35, st)).toBe("silver");
    expect(levelOf(1.5, st)).toBe("gold");
  });
  it("gives the next target and the gap", () => {
    const st = s(1.0, 1.2, 1.5);
    expect(nextTarget(0.9, st)).toEqual({ level: "bronze", at: 1.0, gap: expect.closeTo(0.1, 5) });
    expect(nextTarget(1.3, st)).toEqual({ level: "gold", at: 1.5, gap: expect.closeTo(0.2, 5) });
    expect(nextTarget(1.6, st)).toBeNull();
  });
  it("works when only some levels are set", () => {
    const st = s(null, 30, null);
    expect(levelOf(29, st)).toBe("below");
    expect(levelOf(31, st)).toBe("silver");
    expect(nextTarget(31, st)).toBeNull();
    expect(hasStandards(s(null, null, null))).toBe(false);
  });
});

describe("metrics", () => {
  it("3RM lifts use estimated 1RM ÷ bodyweight", () => {
    // 100 kg × 3 → e1RM 105 (avg Epley 110, Brzycki 105.9 → 107.95 → 108) ÷ 80 = 1.35
    const v = STANDARD_METRICS.bench_3rm.value({ load_kg: 100 }, 80);
    expect(v).toBeCloseTo(1.35, 2);
    expect(STANDARD_METRICS.bench_3rm.value({ load_kg: 100 }, null)).toBeNull();
  });
  it("one-leg tests use the weaker leg; MAS in m/s; Wingate W/kg", () => {
    expect(STANDARD_METRICS.triple_hop.value({ left_cm: 520, right_cm: 495 }, null)).toBe(4.95);
    expect(STANDARD_METRICS.mas_5min.value({ distance_m: 1350 }, null)).toBe(4.5);
    expect(STANDARD_METRICS.wingate_30s.value({ peak_w: 1200 }, 80)).toBe(15);
    expect(formatMetric(1.3456, "bench_3rm")).toBe("1.35 × BW");
    expect(formatMetric(36, "cmj")).toBe("36.0 cm");
  });
});

describe("coach settings validation", () => {
  it("accepts blanks and increasing numbers only", () => {
    expect(validateStandard({ bronze: "1", silver: "1,2", gold: "1.5" })).toEqual({ ok: { bronze: 1, silver: 1.2, gold: 1.5 } });
    expect(validateStandard({ bronze: "", silver: "", gold: "" })).toEqual({ ok: { bronze: null, silver: null, gold: null } });
    expect(validateStandard({ bronze: "1.5", silver: "1.2", gold: "" })).toHaveProperty("error");
    expect(validateStandard({ bronze: "abc", silver: "", gold: "" })).toHaveProperty("error");
    expect(validateStandard({ bronze: "2", silver: "", gold: "2" })).toHaveProperty("error");
  });
});
