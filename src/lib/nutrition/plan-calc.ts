// Coach meal plan targets, following MEAL_PLAN_SYSTEM.md (TYPERFORMANCE). Pure, unit-tested.
// Mifflin-St Jeor for TDEE; deficits and carb styles per plan type; flags before building.
import { bmr, type Sex } from "@/lib/programming/mealplan";

export type PlanType = "standard_loss" | "aggressive_cut" | "maintenance" | "lean_gain" | "keto" | "fight_week";
export const PLAN_TYPES: [PlanType, string, string][] = [
  ["standard_loss", "Standard fat loss (4 weeks)", "Moderate deficit, lower carb (not keto). About 0.5–0.7 kg/week."],
  ["aggressive_cut", "Aggressive cut (15 days)", "High deficit, low carb, higher protein. Short phases only."],
  ["maintenance", "Maintenance / performance", "Eat to maintain weight and fuel training."],
  ["lean_gain", "Lean gain", "Small surplus for muscle gain."],
  ["keto", "Keto (short phase)", "Net carbs under 25 g, fat about 70% of calories."],
  ["fight_week", "Fight week / weight cut", "Use The Fighter's Dietitian protocol. The app won't calculate this."],
];
export const ACTIVITY_LEVELS: [string, number, string][] = [
  ["sedentary", 1.2, "Sedentary"],
  ["light", 1.375, "Lightly active"],
  ["moderate", 1.55, "Moderately active"],
  ["very", 1.725, "Very active"],
];

export interface PlanInputs {
  sex: Sex;
  age: number;
  kg: number;
  cm: number;
  activity: string; // key of ACTIVITY_LEVELS
  type: PlanType;
  breastfeeding?: boolean;
}
export interface DayTargets {
  kcal: number;
  p: number;
  c: number;
  f: number;
}
export interface PlanTargets {
  tdee: number;
  train: DayTargets;
  rest: DayTargets;
  deficitPct: number; // + = deficit, - = surplus (rest day vs TDEE)
  ratePerWeek: number | null; // kg/week estimate (7700 kcal/kg), negative = loss
  flags: string[];
}

const r5 = (n: number) => Math.round(n / 5) * 5;
export const kcalOf = (d: Omit<DayTargets, "kcal">) => Math.round(d.p * 4 + d.c * 4 + d.f * 9);

/** Solve a day: protein fixed, carbs per style, fat takes the rest (or fat 30% for balanced). */
function solve(kcal: number, kg: number, type: PlanType, training: boolean): DayTargets {
  const p = r5(kg * (type === "aggressive_cut" ? (training ? 2.2 : 2.0) : type === "keto" ? 1.8 : type === "lean_gain" ? 1.8 : 2.0));
  let c: number;
  if (type === "keto") c = 20;
  else if (type === "aggressive_cut") c = training ? 50 : 35;
  else if (type === "standard_loss") c = training ? 120 : 100;
  else c = -1;
  let f: number;
  if (c >= 0) {
    f = Math.max(Math.round((kcal - p * 4 - c * 4) / 9), Math.round(kg * 0.6));
  } else {
    f = Math.round((kcal * 0.3) / 9);
    c = Math.max(0, r5((kcal - p * 4 - f * 9) / 4));
  }
  const out = { p, c, f };
  return { ...out, kcal: kcalOf(out) };
}

export function planTargets(i: PlanInputs): PlanTargets {
  const factor = ACTIVITY_LEVELS.find((a) => a[0] === i.activity)?.[1] ?? 1.55;
  let tdee = Math.round(bmr(i.sex, i.kg, i.cm, i.age) * factor);
  if (i.breastfeeding) tdee += 500;
  const flags: string[] = [];
  const pct = { standard_loss: 0.2, aggressive_cut: 0.3, maintenance: 0, lean_gain: -0.1, keto: 0.2, fight_week: 0 }[i.type];
  const restKcal = Math.round(tdee * (1 - pct));
  const trainKcal = restKcal + (i.type === "maintenance" || i.type === "lean_gain" ? 250 : 150);
  const rest = solve(restKcal, i.kg, i.type, false);
  const train = solve(trainKcal, i.kg, i.type, true);
  const deficitPct = Math.round((1 - rest.kcal / tdee) * 100);
  if (i.type === "fight_week") flags.push("Fight week: use The Fighter's Dietitian protocol and enter the numbers yourself.");
  if (rest.kcal < 1200 || train.kcal < 1200) flags.push("Below 1,200 kcal a day. Revise before building.");
  if (deficitPct > 20) flags.push(`Deficit is ${deficitPct}% (over 20%). Keep this phase short.`);
  if (i.breastfeeding) flags.push("Breastfeeding: +500 kcal lactation allowance added to TDEE.");
  if (i.type === "keto") flags.push("Keto: short phase only. Include electrolytes.");
  const weekly = (rest.kcal * 4 + train.kcal * 3 - tdee * 7) / 7700;
  return { tdee, train, rest, deficitPct, ratePerWeek: i.type === "fight_week" ? null : Math.round(weekly * 100) / 100, flags };
}

/** Totals for a list of meals with macros. */
export function sumMeals(ms: { kcal: number; p: number; c: number; f: number }[]): DayTargets {
  return ms.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { kcal: 0, p: 0, c: 0, f: 0 });
}
