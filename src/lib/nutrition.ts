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

export interface NutritionPlan {
  carbs: [number, number];
  protein: [number, number];
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
  return {
    carbs: [r5(bodyweightKg * d.carbs[0]), r5(bodyweightKg * d.carbs[1])],
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
