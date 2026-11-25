import { describe, it, expect } from "vitest";
import { SCHEME_PRESETS } from "@/lib/programming/scheme-presets";
import { parseScheme, schemeLoadOf, schemeRow } from "@/lib/programming/schemes";
import { formatSetPlan } from "@/lib/prescription";

describe("built-in loading schemes", () => {
  for (const p of SCHEME_PRESETS)
    it(`${p.name} parses and fits the database`, () => {
      const r = parseScheme(p.text);
      expect("weeks" in r).toBe(true);
      if (!("weeks" in r)) return;
      const load = schemeLoadOf(r.weeks);
      for (const w of r.weeks) {
        const row = schemeRow(w, load);
        expect(row.sets).toBeGreaterThanOrEqual(1);
        expect(row.sets).toBeLessThanOrEqual(20);
        expect(row.reps.length).toBeLessThanOrEqual(20);
        expect(formatSetPlan(w)).not.toBe("");
      }
      expect(p.description).not.toMatch(/—/);
    });
  it("5/3/1 AMRAP sets keep the +", () => {
    const r = parseScheme("5@65%, 5@75%, 5+@85%");
    expect("weeks" in r && r.weeks[0][2]).toEqual({ r: "5+", p: 85 });
  });
});
