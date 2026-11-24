// Energy/macro calculator and a sample day of eating. General guidance only.
// Pure functions (unit-tested).

export type Sex = "male" | "female";
export type Goal = "lose" | "maintain" | "gain";

export const ACTIVITY = [
  [1.2, "Mostly sitting, little exercise"],
  [1.375, "Light: 1–3 sessions a week"],
  [1.55, "Moderate: 3–5 sessions a week"],
  [1.725, "Hard: 6–7 sessions a week"],
  [1.9, "Very hard: twice a day / fight camp"],
] as const;

/** Mifflin–St Jeor resting energy (kcal/day). */
export function bmr(sex: Sex, kg: number, cm: number, age: number): number {
  return Math.round(10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161));
}

export interface Targets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export function targets(input: { sex: Sex; kg: number; cm: number; age: number; activity: number; goal: Goal }): Targets {
  const tdee = bmr(input.sex, input.kg, input.cm, input.age) * input.activity;
  const calories =
    input.goal === "lose"
      ? Math.max(Math.round(tdee * 0.8), Math.round(tdee - 500))
      : input.goal === "gain"
        ? Math.round(tdee * 1.1)
        : Math.round(tdee);
  const protein_g = Math.round(input.kg * (input.goal === "lose" ? 2.2 : input.goal === "gain" ? 1.8 : 2.0));
  const fat_g = Math.round(Math.max(0.8 * input.kg, (calories * 0.25) / 9));
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));
  return { calories: Math.round(calories / 10) * 10, protein_g, carbs_g, fat_g };
}

export interface Food {
  name: string;
  p: number; // per 100 g
  c: number;
  f: number;
}

// Approximate values per 100 g (cooked where noted).
export const PROTEINS: Food[] = [
  { name: "Chicken breast (cooked)", p: 31, c: 0, f: 3.6 },
  { name: "Lean beef mince 5% (cooked)", p: 26, c: 0, f: 7 },
  { name: "Salmon (cooked)", p: 25, c: 0, f: 12 },
  { name: "Tuna in springwater", p: 25, c: 0, f: 1 },
  { name: "Turkey breast (cooked)", p: 29, c: 0, f: 2 },
];
export const BREAKFAST_PROTEINS: Food[] = [
  { name: "Greek yoghurt, no fat", p: 10, c: 4, f: 0.2 },
  { name: "Eggs", p: 13, c: 1, f: 10 },
];
export const CARBS: Food[] = [
  { name: "White rice (cooked)", p: 2.7, c: 28, f: 0.3 },
  { name: "Potato (cooked)", p: 2, c: 17, f: 0.1 },
  { name: "Pasta (cooked)", p: 5.8, c: 30, f: 0.9 },
  { name: "Sweet potato (cooked)", p: 2, c: 20, f: 0.1 },
];
export const BREAKFAST_CARBS: Food[] = [
  { name: "Rolled oats", p: 13, c: 60, f: 7 },
  { name: "Wholemeal bread", p: 10, c: 42, f: 3.4 },
];
export const SNACK: Food[] = [
  { name: "Banana", p: 1.1, c: 23, f: 0.3 },
  { name: "Whey protein", p: 78, c: 8, f: 6 },
];
export const FATS: Food[] = [
  { name: "Olive oil", p: 0, c: 0, f: 100 },
  { name: "Avocado", p: 2, c: 8.5, f: 15 },
  { name: "Almonds", p: 21, c: 9, f: 50 },
];
const VEG: Food = { name: "Mixed vegetables", p: 2, c: 5, f: 0.3 };

export interface MealItem {
  food: string;
  grams: number;
}
export interface Meal {
  name: string;
  items: MealItem[];
  totals: Targets;
}

const r5 = (n: number) => Math.max(0, Math.round(n / 5) * 5);

function build(name: string, t: { p: number; c: number; f: number }, prot: Food, carb: Food, fat: Food | null, veg: boolean): Meal {
  // Solve for grams of protein, carb and fat foods together (each food carries
  // some of the other macros), a few rounds of Gauss–Seidel is plenty.
  const v = veg ? 150 : 0;
  let gP = 0, gC = 0, gF = 0;
  for (let k = 0; k < 8; k++) {
    gP = Math.max(0, ((t.p - (VEG.p * v + carb.p * gC + (fat?.p ?? 0) * gF) / 100) / prot.p) * 100);
    gC = Math.max(0, ((t.c - (VEG.c * v + prot.c * gP + (fat?.c ?? 0) * gF) / 100) / carb.c) * 100);
    gF = fat ? Math.max(0, ((t.f - (VEG.f * v + prot.f * gP + carb.f * gC) / 100) / fat.f) * 100) : 0;
  }
  const items: MealItem[] = [];
  let p = 0, c = 0, f = 0;
  const add = (food: Food, g: number) => {
    if (g <= 0) return;
    items.push({ food: food.name, grams: g });
    p += (food.p * g) / 100;
    c += (food.c * g) / 100;
    f += (food.f * g) / 100;
  };
  add(VEG, v);
  add(prot, r5(gP));
  add(carb, r5(gC));
  if (fat) add(fat, r5(gF));
  return {
    name,
    items,
    totals: { calories: Math.round(p * 4 + c * 4 + f * 9), protein_g: Math.round(p), carbs_g: Math.round(c), fat_g: Math.round(f) },
  };
}

/** A sample day split evenly over 3–5 meals; `day` rotates the food choices. */
export function sampleDay(t: Targets, meals = 4, day = 0): Meal[] {
  const n = Math.min(5, Math.max(3, meals));
  const share = { p: t.protein_g / n, c: t.carbs_g / n, f: t.fat_g / n };
  const pick = <T,>(list: T[], k: number) => list[(day + k) % list.length];
  const out: Meal[] = [build("Breakfast", share, pick(BREAKFAST_PROTEINS, 0), pick(BREAKFAST_CARBS, 0), pick(FATS, 2), false)];
  const mains = ["Lunch", "Dinner"];
  const snacks = n - 3;
  for (let i = 0; i < snacks; i++)
    out.push(build(`Snack ${i + 1}`, share, SNACK[1], SNACK[0], pick(FATS, 2), false));
  mains.forEach((m, i) => out.push(build(m, share, pick(PROTEINS, i * 2), pick(CARBS, i), pick(FATS, i), true)));
  return out;
}

export function dayTotals(meals: Meal[]): Targets {
  return meals.reduce(
    (a, m) => ({
      calories: a.calories + m.totals.calories,
      protein_g: a.protein_g + m.totals.protein_g,
      carbs_g: a.carbs_g + m.totals.carbs_g,
      fat_g: a.fat_g + m.totals.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}
