import { describe, it, expect } from "vitest";
import { kcalOf, planTargets } from "@/lib/nutrition/plan-calc";

const base = { sex: "female" as const, age: 38, kg: 78, cm: 165, activity: "light" };
describe("meal plan targets", () => {
  it("macros always add up to the calories (P×4 + C×4 + F×9)", () => {
    for (const type of ["standard_loss", "aggressive_cut", "maintenance", "lean_gain", "keto"] as const) {
      const t = planTargets({ ...base, type });
      for (const d of [t.train, t.rest]) expect(Math.abs(kcalOf(d) - d.kcal)).toBeLessThan(10);
    }
  });
  it("standard loss is lower carb with training days a bit higher", () => {
    const t = planTargets({ ...base, type: "standard_loss" });
    expect(t.rest.c).toBe(100);
    expect(t.train.c).toBe(120);
    expect(t.train.kcal).toBeGreaterThan(t.rest.kcal);
    expect(t.ratePerWeek!).toBeLessThan(0);
  });
  it("flags low calories and big deficits", () => {
    const t = planTargets({ ...base, kg: 55, cm: 155, type: "aggressive_cut" });
    expect(t.flags.some((f) => /1,200/.test(f))).toBe(true);
    expect(t.flags.some((f) => /over 20%/.test(f))).toBe(true);
  });
  it("adds the lactation allowance", () => {
    expect(planTargets({ ...base, type: "maintenance", breastfeeding: true }).tdee - planTargets({ ...base, type: "maintenance" }).tdee).toBe(500);
  });
});
