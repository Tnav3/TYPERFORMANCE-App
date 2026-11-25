// Meal plan content helpers: day slots, the standard sections from the TYPERFORMANCE template,
// shopping list and ingredient parsing. Pure, unit-tested.
export type DayKey = "train_a" | "train_b" | "rest_a" | "rest_b";
export const DAYS: [DayKey, string, "train" | "rest"][] = [
  ["train_a", "Training day · Option A", "train"],
  ["train_b", "Training day · Option B", "train"],
  ["rest_a", "Rest day · Option A", "rest"],
  ["rest_b", "Rest day · Option B", "rest"],
];
export const SLOTS = ["breakfast", "lunch", "dinner"] as const;
export type Slot = (typeof SLOTS)[number];
export interface DayPlan {
  breakfast?: string | null;
  lunch?: string | null;
  dinner?: string | null;
  snacks?: string[];
}
export type Days = Partial<Record<DayKey, DayPlan>>;

export interface Ingredient {
  item: string;
  amount: string;
  brand: string;
}
export interface LibraryMeal {
  id: string;
  name: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: Ingredient[];
  steps: string[];
  note: string | null;
  family_note: string | null;
  tags: string[];
}

/** "Chicken thigh | 150 g | Lilydale" per line → ingredients. */
export function parseIngredients(text: string): Ingredient[] {
  return text
    .split("\n")
    .map((l) => l.split("|").map((x) => x.trim()))
    .filter((p) => p[0])
    .slice(0, 30)
    .map(([item, amount = "", brand = ""]) => ({ item: item.slice(0, 80), amount: amount.slice(0, 40), brand: brand.slice(0, 60) }));
}
export const ingredientsText = (xs: Ingredient[]) => xs.map((x) => [x.item, x.amount, x.brand].filter((v, i) => v || i === 0).join(" | ")).join("\n");

/** No em dashes in client copy (house rule). */
export const noEmDash = (s: string) => s.replace(/\s*—\s*/g, ", ").replace(/–/g, "-");

export function mealsInDay(d: DayPlan | undefined): string[] {
  if (!d) return [];
  return [d.breakfast, d.lunch, d.dinner, ...(d.snacks ?? [])].filter((x): x is string => !!x);
}

/** Shopping list from every ingredient used, grouped by a simple keyword rule, de-duplicated. */
export function shoppingList(meals: LibraryMeal[]): Record<string, string[]> {
  const groups: Record<string, Set<string>> = { Proteins: new Set(), "Dairy and fats": new Set(), Vegetables: new Set(), "Pantry staples": new Set() };
  for (const m of meals)
    for (const i of m.ingredients) {
      const n = i.item.toLowerCase();
      const label = i.brand ? `${i.item} (${i.brand})` : i.item;
      const g = /chicken|beef|lamb|pork|turkey|fish|salmon|tuna|prawn|egg|mince|steak|kabana|ham|sardine|whey|protein/.test(n)
        ? "Proteins"
        : /milk|yoghurt|yogurt|cheese|feta|halloumi|butter|cream|oil|avocado|nut|almond|walnut|macadamia|tahini/.test(n)
          ? "Dairy and fats"
          : /spinach|broccoli|bean|zucchini|capsicum|tomato|cucumber|lettuce|onion|carrot|mushroom|kale|cabbage|asparagus|veg|salad|herb|coriander|parsley|berr|banana|apple|fruit|lemon|garlic/.test(n)
            ? "Vegetables"
            : "Pantry staples";
      groups[g].add(label);
    }
  return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, [...v].sort()]));
}

// Standard sections, from TYPERFORMANCE_meal_plan_template.md
export const EATING_OUT: [string, string][] = [
  ["Cafe", "Eggs any style, swap toast for avo or spinach. Add a protein if possible."],
  ["Any restaurant", "Grilled protein + salad formula. Ask for sauce on the side."],
  ["Lebanese / Middle Eastern", "Grilled meats, fattoush without bread. Skip the dips in a low sodium phase."],
  ["Fast food", "Bunless burger in a lettuce wrap, no chips. aussiefastfoodmacros.com has accurate AU numbers."],
  ["Family BBQ / social", "Protein + salad. Eat beforehand if you're not sure what's on offer."],
  ["Supermarket emergency", "Kabana, cheese sticks, tuna, mixed nuts or deli eggs."],
];
export const SPICES = ["Za'atar", "Sumac", "Ground cumin", "Ground cinnamon", "Ground allspice", "Ground coriander", "Ground turmeric", "Smoked paprika", "Dried oregano", "Chilli flakes"];
