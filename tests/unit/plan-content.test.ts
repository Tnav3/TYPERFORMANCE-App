import { describe, it, expect } from "vitest";
import { ingredientsText, mealsInDay, noEmDash, parseIngredients, shoppingList, type LibraryMeal } from "@/lib/nutrition/plan-content";

describe("meal plan content", () => {
  it("parses and prints ingredients", () => {
    const xs = parseIngredients("Chicken thigh | 150 g | Lilydale\nBroccolini | 1 bunch\n\n");
    expect(xs).toEqual([{ item: "Chicken thigh", amount: "150 g", brand: "Lilydale" }, { item: "Broccolini", amount: "1 bunch", brand: "" }]);
    expect(ingredientsText(xs)).toBe("Chicken thigh | 150 g | Lilydale\nBroccolini | 1 bunch");
  });
  it("removes em dashes", () => expect(noEmDash("Crispy skin — you skip the carbs")).toBe("Crispy skin, you skip the carbs"));
  it("lists a day's meals and builds a shopping list", () => {
    expect(mealsInDay({ breakfast: "a", dinner: "c", snacks: ["s"] })).toEqual(["a", "c", "s"]);
    const m = (ing: [string, string, string][]): LibraryMeal => ({ id: "x", name: "x", slot: "dinner", kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, ingredients: ing.map(([item, amount, brand]) => ({ item, amount, brand })), steps: [], note: null, family_note: null, tags: [] });
    const s = shoppingList([m([["Chicken thigh", "150 g", "Lilydale"], ["Broccolini", "1", ""]]), m([["Feta", "30 g", ""], ["Chicken thigh", "150 g", "Lilydale"]])]);
    expect(s.Proteins).toEqual(["Chicken thigh (Lilydale)"]);
    expect(s.Vegetables).toEqual(["Broccolini"]);
    expect(s["Dairy and fats"]).toEqual(["Feta"]);
  });
});
