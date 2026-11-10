import { describe, it, expect } from "vitest";
import {
  assess,
  latestByMeasure,
  parseRomForm,
  fmt,
  type RomEntry,
  type RomMeasure,
} from "@/lib/mobility";

const m = (o: Partial<RomMeasure>): RomMeasure => ({
  key: "hip_ir",
  name: "Hip IR",
  region: "hip",
  unit: "deg",
  sided: true,
  norm: 45,
  norm_text: "45°",
  asym_pct: 10,
  asym_abs: null,
  self_test: false,
  instructions: null,
  source: null,
  sort_order: 1,
  active: true,
  ...o,
});
const e = (o: Partial<RomEntry>): RomEntry => ({
  id: "x",
  athlete_id: "a",
  measure_key: "hip_ir",
  measured_on: "2026-11-01",
  left_value: null,
  right_value: null,
  value: null,
  entered_by: "a",
  created_at: "2026-11-01T00:00:00Z",
  ...o,
});
const form = (o: Record<string, string>) => ({
  get: (k: string) => o[k] ?? null,
});

describe("assess", () => {
  it("within norm when both sides reach it; names the side that doesn't", () => {
    expect(assess(m({}), e({ left_value: 45, right_value: 50 })).status).toBe(
      "within",
    );
    const r = assess(m({}), e({ left_value: 38, right_value: 46 }));
    expect(r.status).toBe("below");
    expect(r.belowSides).toEqual(["left"]);
  });
  it("flags a gap of 10% of the better side or more (boundary counts)", () => {
    const r = assess(m({}), e({ left_value: 45, right_value: 50 }));
    expect(r.asymmetry).toEqual({ gap: 5, pct: 10, weaker: "left" });
    expect(r.asymFlag).toBe(true);
    expect(assess(m({}), e({ left_value: 46, right_value: 50 })).asymFlag).toBe(
      false,
    );
    expect(
      assess(m({}), e({ left_value: 50, right_value: 50 })).asymmetry,
    ).toBeNull();
  });
  it("absolute gap rule for cm measures (knee-to-wall: 2 cm)", () => {
    const ktw = m({
      key: "knee_to_wall",
      unit: "cm",
      norm: 10,
      asym_pct: null,
      asym_abs: 2,
    });
    expect(assess(ktw, e({ left_value: 12, right_value: 10 })).asymFlag).toBe(
      true,
    );
    expect(assess(ktw, e({ left_value: 12, right_value: 10.5 })).asymFlag).toBe(
      false,
    );
    expect(
      assess(ktw, e({ left_value: 9, right_value: 12 })).belowSides,
    ).toEqual(["left"]);
  });
  it("Thomas thigh angle: 0 passes, negative (above horizontal) is below norm", () => {
    const th = m({ key: "thomas_hip", norm: 0, asym_pct: null, asym_abs: 5 });
    expect(assess(th, e({ left_value: 0, right_value: 8 })).status).toBe(
      "within",
    );
    expect(
      assess(th, e({ left_value: -4, right_value: 8 })).belowSides,
    ).toEqual(["left"]);
    expect(assess(th, e({ left_value: -4, right_value: 8 })).asymFlag).toBe(
      true,
    );
  });
  it("single measures and measures without a norm", () => {
    const neck = m({ sided: false, norm: 45 });
    expect(assess(neck, e({ value: 44 })).status).toBe("below");
    expect(
      assess(m({ sided: false, norm: null }), e({ value: 10 })).status,
    ).toBe("no_norm");
  });
});

describe("latest and parsing", () => {
  it("latest per measure by date then save time", () => {
    const l = latestByMeasure([
      e({ id: "1", measured_on: "2026-10-01" }),
      e({
        id: "2",
        measured_on: "2026-11-01",
        created_at: "2026-11-01T01:00:00Z",
      }),
      e({
        id: "3",
        measured_on: "2026-11-01",
        created_at: "2026-11-01T02:00:00Z",
      }),
      e({ id: "4", measure_key: "hip_er", measured_on: "2026-09-01" }),
    ]);
    expect(l.hip_ir.id).toBe("3");
    expect(l.hip_er.id).toBe("4");
  });
  it("skips blank measures, needs both sides, rejects junk", () => {
    const ms = [
      m({}),
      m({ key: "neck", sided: false }),
      m({ key: "ktw", unit: "cm" }),
    ];
    expect(
      parseRomForm(ms, form({ hip_ir_l: "40", hip_ir_r: "38.5", neck: "" })),
    ).toEqual({
      ok: true,
      rows: [
        {
          measure_key: "hip_ir",
          left_value: 40,
          right_value: 38.5,
          value: null,
        },
      ],
    });
    expect(parseRomForm(ms, form({ hip_ir_l: "40" }))).toEqual({
      ok: false,
      errors: { hip_ir: "Enter both sides" },
    });
    expect(parseRomForm(ms, form({ neck: "abc" })).ok).toBe(false);
    expect(parseRomForm(ms, form({ ktw_l: "-2", ktw_r: "5" })).ok).toBe(false);
    expect(parseRomForm(ms, form({}))).toEqual({
      ok: false,
      errors: { _: "Enter at least one measure" },
    });
    expect(parseRomForm(ms, form({ hip_ir_l: "-5", hip_ir_r: "3" })).ok).toBe(
      true,
    );
  });
  it("formats degrees and cm", () => {
    expect(fmt(45, m({}))).toBe("45°");
    expect(fmt(9.5, m({ unit: "cm" }))).toBe("9.5 cm");
  });
});
