// Nutrition guide: daily carbohydrate and protein ranges by training day type.
// Sources: Thomas, Erdman & Burke 2016 (ACSM / Academy of Nutrition and
// Dietetics / Dietitians of Canada joint position statement) for carbohydrate
// and recovery; Jäger et al. 2017 (ISSN position stand) for protein.
// Pure functions: unit-tested. No calorie or weight-cut targets on purpose.

export type DayType = "rest" | "moderate" | "hard" | "very_hard";

export const DAY_TYPES: {
  key: DayType;
  label: string;
  hint: string;
  carbs: [number, number]; // g/kg/day
}[] = [
  {
    key: "rest",
    label: "Rest / light",
    hint: "Rest day, walking, light skill work",
    carbs: [3, 5],
  },
  {
    key: "moderate",
    label: "Training",
    hint: "About 1 hour of training",
    carbs: [5, 7],
  },
  {
    key: "hard",
    label: "Hard / double",
    hint: "1–3 hours, e.g. two sessions",
    carbs: [6, 10],
  },
  {
    key: "very_hard",
    label: "Very hard",
    hint: "4+ hours (rare: camp days)",
    carbs: [8, 12],
  },
];

export const PROTEIN_G_PER_KG: [number, number] = [1.4, 2.0];
export const PROTEIN_PER_MEAL_G_PER_KG = 0.25;
export const RECOVERY_CARB_G_PER_KG_H: [number, number] = [1.0, 1.2];

const r5 = (n: number) => Math.round(n / 5) * 5;

/**
 * Fat: the joint statement gives a share of energy (20–35%), not g/kg. With no
 * calorie estimate, fat is set so it makes up 25–30% of energy alongside the
 * middle of the carb and protein ranges.
 */
export const FAT_SHARE: [number, number] = [0.25, 0.3];

export interface NutritionPlan {
  carbs: [number, number];
  protein: [number, number];
  fat: [number, number];
  proteinPerMeal: number;
  meals: number;
  /** Fast refuel when training again within 8 h (hard days only). */
  recoveryCarbsPerHour: [number, number] | null;
}

export function validBodyweight(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 35 && n <= 200 ? n : null;
}

export function nutritionFor(
  bodyweightKg: number,
  day: DayType,
): NutritionPlan {
  const d = DAY_TYPES.find((x) => x.key === day)!;
  const perMeal = r5(bodyweightKg * PROTEIN_PER_MEAL_G_PER_KG);
  const protein: [number, number] = [
    r5(bodyweightKg * PROTEIN_G_PER_KG[0]),
    r5(bodyweightKg * PROTEIN_G_PER_KG[1]),
  ];
  const carbs: [number, number] = [
    r5(bodyweightKg * d.carbs[0]),
    r5(bodyweightKg * d.carbs[1]),
  ];
  // kcal from the middle of carbs + protein; fat fills its share of the total
  const cpKcal =
    4 * ((carbs[0] + carbs[1]) / 2 + (protein[0] + protein[1]) / 2);
  const fatFor = (share: number) => r5((cpKcal * share) / (1 - share) / 9);
  return {
    carbs,
    fat: [fatFor(FAT_SHARE[0]), fatFor(FAT_SHARE[1])],
    protein,
    proteinPerMeal: perMeal,
    // Enough even protein doses to reach the bottom of the daily range
    meals: Math.max(
      3,
      Math.min(6, Math.ceil(protein[0] / Math.max(perMeal, 1))),
    ),
    recoveryCarbsPerHour:
      day === "hard" || day === "very_hard"
        ? [
            r5(bodyweightKg * RECOVERY_CARB_G_PER_KG_H[0]),
            r5(bodyweightKg * RECOVERY_CARB_G_PER_KG_H[1]),
          ]
        : null,
  };
}

export interface MealRow {
  name: string;
  carbs: number;
  protein: number;
  fat: number;
}

// Shares of the day's total per meal. Training days put carbs around the
// session and keep fat low just before it; rest days spread things evenly.
const TRAINING_SPLIT: { name: string; c: number; p: number; f: number }[] = [
  { name: "Breakfast", c: 0.25, p: 0.25, f: 0.25 },
  { name: "Pre-training snack", c: 0.15, p: 0.1, f: 0.05 },
  { name: "Post-training meal", c: 0.3, p: 0.25, f: 0.2 },
  { name: "Dinner", c: 0.25, p: 0.25, f: 0.3 },
  { name: "Evening snack", c: 0.05, p: 0.15, f: 0.2 },
];
const REST_SPLIT: { name: string; c: number; p: number; f: number }[] = [
  { name: "Breakfast", c: 0.3, p: 0.25, f: 0.25 },
  { name: "Lunch", c: 0.3, p: 0.25, f: 0.3 },
  { name: "Dinner", c: 0.3, p: 0.3, f: 0.3 },
  { name: "Snack", c: 0.1, p: 0.2, f: 0.15 },
];

const mid = ([a, b]: [number, number]) => (a + b) / 2;

/** A sample day: the middle of each range split across meals (grams, nearest 5). */
export function sampleDay(plan: NutritionPlan, day: DayType): MealRow[] {
  const split = day === "rest" ? REST_SPLIT : TRAINING_SPLIT;
  return split.map((m) => ({
    name: m.name,
    carbs: r5(mid(plan.carbs) * m.c),
    protein: r5(mid(plan.protein) * m.p),
    fat: r5(mid(plan.fat) * m.f),
  }));
}

/** Rough serves for the FAQ swap tables: ~30 g carbs, ~25 g protein a serve. */
export const serves = (grams: number, perServe: number) =>
  Math.round((grams / perServe) * 2) / 2;
