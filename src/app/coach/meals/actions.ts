"use server";
// Coach meal library + per-client meal plans (TYPERFORMANCE system, no AI).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { coachOnly, dec, friendly, int, str, UUID } from "@/lib/programming/server";
import { DAYS, mealsInDay, noEmDash, parseIngredients, shoppingList, type Days, type LibraryMeal } from "@/lib/nutrition/plan-content";
import { PLAN_TYPES, planTargets, type PlanType } from "@/lib/nutrition/plan-calc";

function go(path: string, error?: string): never {
  revalidatePath(path.split(/[?#]/)[0]);
  redirect(error ? `${path.split("#")[0]}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : path);
}
const SLOT = ["breakfast", "lunch", "dinner", "snack"];
const clean = (v: string | null) => (v ? noEmDash(v) : null);

// ---------- Library ----------
export async function saveMeal(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const back = String(fd.get("back") ?? "/coach/meals");
  const slot = String(fd.get("slot") ?? "");
  const row = {
    name: clean(str(fd.get("name"), 120)),
    slot,
    kcal: int(fd.get("kcal")),
    protein_g: dec(fd.get("protein_g")),
    carbs_g: dec(fd.get("carbs_g")),
    fat_g: dec(fd.get("fat_g")),
    ingredients: parseIngredients(String(fd.get("ingredients") ?? "")),
    steps: String(fd.get("steps") ?? "").split("\n").map((s) => noEmDash(s.trim())).filter(Boolean).slice(0, 15),
    note: clean(str(fd.get("note"), 300)),
    family_note: clean(str(fd.get("family_note"), 300)),
    tags: String(fd.get("tags") ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10),
    updated_at: new Date().toISOString(),
  };
  if (!row.name || !SLOT.includes(slot) || row.kcal == null || row.protein_g == null || row.carbs_g == null || row.fat_g == null)
    go(back, "Name, meal type and all four numbers are needed.");
  const calc = Math.round(row.protein_g * 4 + row.carbs_g * 4 + row.fat_g * 9);
  if (Math.abs(calc - row.kcal) > Math.max(25, row.kcal * 0.08))
    go(back, `Macros add to ${calc} kcal but you entered ${row.kcal}. Check the numbers.`);
  const { error } = UUID.test(id)
    ? await supabase.from("meal_library").update(row).eq("id", id)
    : await supabase.from("meal_library").insert(row);
  go(back.split("?")[0].replace(/\/edit$/, ""), error ? friendly(error.message) : undefined);
}

export async function deleteMeal(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("meal_library").delete().eq("id", id);
  go("/coach/meals");
}

// ---------- Plans ----------
const planPath = (athlete: string, plan?: string) => `/coach/athlete/${athlete}/meal-plans${plan ? `?plan=${plan}` : ""}`;

export async function createMealPlan(fd: FormData) {
  const supabase = await coachOnly();
  const athlete = String(fd.get("athlete_id") ?? "");
  if (!UUID.test(athlete)) go("/coach/clients");
  const type = String(fd.get("type") ?? "") as PlanType;
  const inputs = {
    sex: fd.get("sex") === "female" ? "female" : "male",
    age: int(fd.get("age")),
    kg: dec(fd.get("kg")),
    cm: int(fd.get("cm")),
    activity: String(fd.get("activity") ?? "moderate"),
    type,
    breastfeeding: fd.get("breastfeeding") === "on",
    dietary: str(fd.get("dietary"), 300),
  };
  const ok = PLAN_TYPES.some((p) => p[0] === type) && inputs.age && inputs.age >= 16 && inputs.age <= 90 && inputs.kg && inputs.kg >= 35 && inputs.kg <= 220 && inputs.cm && inputs.cm >= 130 && inputs.cm <= 225;
  if (!ok) go(planPath(athlete), "Check age (16–90), weight and height.");
  const t = planTargets(inputs as Parameters<typeof planTargets>[0]);
  const title = str(fd.get("title"), 80) ?? PLAN_TYPES.find((p) => p[0] === type)![1];
  const { data, error } = await supabase
    .from("meal_plans")
    .insert({ athlete_id: athlete, title, inputs, targets: { tdee: t.tdee, train: t.train, rest: t.rest, flags: t.flags, rate: t.ratePerWeek } })
    .select("id")
    .single();
  if (error || !data) go(planPath(athlete), friendly(error?.message));
  go(planPath(athlete, data.id));
}

export async function saveTargets(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("plan_id") ?? "");
  const athlete = String(fd.get("athlete_id") ?? "");
  if (!UUID.test(id) || !UUID.test(athlete)) go("/coach/clients");
  const { data: plan } = await supabase.from("meal_plans").select("targets").eq("id", id).single();
  const day = (k: string) => {
    const p = int(fd.get(`${k}_p`)), c = int(fd.get(`${k}_c`)), f = int(fd.get(`${k}_f`));
    if (p == null || c == null || f == null || p < 0 || c < 0 || f < 0 || p > 400 || c > 600 || f > 300) return null;
    return { p, c, f, kcal: Math.round(p * 4 + c * 4 + f * 9) };
  };
  const train = day("train"), rest = day("rest");
  if (!train || !rest) go(planPath(athlete, id), "Enter protein, carbs and fat in grams for both days.");
  const flags = ((plan?.targets as { flags?: string[] })?.flags ?? []).filter((f) => !/1,200/.test(f));
  if (train.kcal < 1200 || rest.kcal < 1200) flags.push("Below 1,200 kcal a day. Revise before building.");
  await supabase.from("meal_plans").update({ targets: { ...(plan?.targets as object), train, rest, flags }, updated_at: new Date().toISOString() }).eq("id", id);
  go(planPath(athlete, id));
}

export async function saveDays(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("plan_id") ?? "");
  const athlete = String(fd.get("athlete_id") ?? "");
  if (!UUID.test(id) || !UUID.test(athlete)) go("/coach/clients");
  const pick = (k: string) => {
    const v = String(fd.get(k) ?? "");
    return UUID.test(v) ? v : null;
  };
  const days: Days = {};
  for (const [k] of DAYS)
    days[k] = {
      breakfast: pick(`${k}_breakfast`),
      lunch: pick(`${k}_lunch`),
      dinner: pick(`${k}_dinner`),
      snacks: fd.getAll(`${k}_snack`).map(String).filter((v) => UUID.test(v)).slice(0, 3),
    };
  await supabase
    .from("meal_plans")
    .update({ days, tips: clean(str(fd.get("tips"), 4000)), substitutes: clean(str(fd.get("substitutes"), 4000)), updated_at: new Date().toISOString() })
    .eq("id", id);
  go(planPath(athlete, id) + "#days");
}

/** Freeze everything the client needs into a snapshot so later library edits don't change it. */
export async function publishMealPlan(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("plan_id") ?? "");
  const athlete = String(fd.get("athlete_id") ?? "");
  if (!UUID.test(id) || !UUID.test(athlete)) go("/coach/clients");
  const { data: plan } = await supabase.from("meal_plans").select("*").eq("id", id).single();
  if (!plan) go(planPath(athlete), "Plan not found.");
  const days = (plan.days ?? {}) as Days;
  const ids = [...new Set(DAYS.flatMap(([k]) => mealsInDay(days[k])))];
  if (!mealsInDay(days.train_a).length || !mealsInDay(days.rest_a).length)
    go(planPath(athlete, id), "Fill in at least Training day A and Rest day A before publishing.");
  const { data: meals } = await supabase.from("meal_library").select("*").in("id", ids);
  const byId = Object.fromEntries((meals ?? []).map((m) => [m.id, m])) as Record<string, LibraryMeal>;
  const snapshot = {
    title: plan.title,
    type: (plan.inputs as { type?: string })?.type ?? null,
    targets: { train: plan.targets.train, rest: plan.targets.rest },
    days,
    meals: byId,
    shopping: shoppingList(Object.values(byId)),
    tips: plan.tips,
    substitutes: plan.substitutes,
  };
  await supabase.from("meal_plans").update({ status: "archived" }).eq("athlete_id", athlete).eq("status", "published");
  const { error } = await supabase
    .from("meal_plans")
    .update({ snapshot, status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
  if (!error) {
    await supabase.from("profiles").update({ feat_mealplan: true }).eq("id", athlete);
  }
  go(planPath(athlete, id), error ? friendly(error.message) : undefined);
}

export async function deleteMealPlan(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("plan_id") ?? "");
  const athlete = String(fd.get("athlete_id") ?? "");
  if (UUID.test(id)) await supabase.from("meal_plans").delete().eq("id", id);
  go(planPath(athlete));
}
