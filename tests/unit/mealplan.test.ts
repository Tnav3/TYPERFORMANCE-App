import { describe, it, expect } from "vitest";
import { bmr, dayTotals, sampleDay, targets } from "@/lib/programming/mealplan";

describe("meal plan builder", () => {
  it("Mifflin–St Jeor", () => {
    expect(bmr("male", 80, 180, 30)).toBe(1780);
    expect(bmr("female", 60, 165, 30)).toBe(1320);
  });
  it("targets add up and follow the goal", () => {
    const m = targets({ sex: "male", kg: 80, cm: 180, age: 30, activity: 1.55, goal: "maintain" });
    expect(m.protein_g).toBe(160);
    expect(Math.abs(m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9 - m.calories)).toBeLessThan(15);
    const lose = targets({ sex: "male", kg: 80, cm: 180, age: 30, activity: 1.55, goal: "lose" });
    expect(lose.calories).toBeLessThan(m.calories);
    expect(lose.calories).toBeGreaterThanOrEqual(Math.round((m.calories * 0.8) / 10) * 10 - 10);
  });
  it("sample day lands close to the targets", () => {
    for (const meals of [3, 4, 5]) {
      const t = targets({ sex: "female", kg: 65, cm: 168, age: 28, activity: 1.725, goal: "maintain" });
      const day = sampleDay(t, meals, 1);
      expect(day).toHaveLength(meals);
      const tot = dayTotals(day);
      expect(Math.abs(tot.protein_g - t.protein_g) / t.protein_g).toBeLessThan(0.12);
      expect(Math.abs(tot.carbs_g - t.carbs_g) / t.carbs_g).toBeLessThan(0.12);
      expect(Math.abs(tot.calories - t.calories) / t.calories).toBeLessThan(0.1);
    }
  });
});
