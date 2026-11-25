import { ClientNavBar } from "@/components/ClientNavBar";
import { requireFeature } from "@/lib/session";
import { bodyweights } from "@/lib/programming/history-data";
import { ACTIVITY, dayTotals, sampleDay, targets, type Goal, type Sex } from "@/lib/programming/mealplan";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { PublishedMealPlan, type MealSnapshot } from "@/components/PublishedMealPlan";
import { formatDate } from "@/lib/dates";
import type { DayKey } from "@/lib/nutrition/plan-content";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text focus:border-brand focus:outline-none";

export default async function MealPlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { supabase, user, profile } = await requireFeature(["athlete"], "mealplan");
  const sp = await searchParams;
  const { data: published } = await supabase
    .from("meal_plans")
    .select("snapshot, published_at")
    .eq("athlete_id", user!.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (published?.snapshot && sp.sample !== "1") {
    return (
      <Screen>
        <BackLink href="/macros" label="Macros" />
        <PublishedMealPlan plan={published.snapshot as MealSnapshot} day={(sp.d ?? "train_a") as DayKey} publishedAt={formatDate(published.published_at.slice(0, 10))} />
        <p className="no-print mt-4 text-center text-xs text-muted">Questions about your plan? Message your coach.</p>
      </Screen>
    );
  }
  const [weights, { data: coachTargets }] = await Promise.all([
    bodyweights(supabase, user!.id, 1),
    supabase.from("macro_targets").select("*").eq("athlete_id", user!.id).maybeSingle(),
  ]);
  const sex: Sex = (sp.sex as Sex) ?? (profile.sex === "female" ? "female" : "male");
  const kg = Number(sp.kg ?? weights[0]?.kg ?? "");
  const cm = Number(sp.cm ?? "");
  const age = Number(sp.age ?? "");
  const activity = Number(sp.activity ?? 1.55);
  const goal = (["lose", "maintain", "gain"].includes(sp.goal ?? "") ? sp.goal : "maintain") as Goal;
  const meals = Math.min(5, Math.max(3, Number(sp.meals ?? 4)));
  const ok = kg >= 35 && kg <= 200 && cm >= 130 && cm <= 220 && age >= 16 && age <= 90 && ACTIVITY.some(([a]) => a === activity);
  const calc = ok ? targets({ sex, kg, cm, age, activity, goal }) : null;
  const useCoach = sp.use === "coach" && coachTargets?.calories && coachTargets.protein_g && coachTargets.carbs_g && coachTargets.fat_g;
  const t = useCoach
    ? { calories: coachTargets.calories, protein_g: coachTargets.protein_g, carbs_g: coachTargets.carbs_g, fat_g: coachTargets.fat_g }
    : calc;
  const variant = Number(sp.v ?? 0) || 0;
  const plan = t ? sampleDay(t, meals, variant) : null;
  const tot = plan ? dayTotals(plan) : null;

  return (
    <Screen>
      <BackLink href="/macros" label="Macros" />
      <Heading sub="General guidance to show what your day could look like. It isn't an individual dietetic plan. If you have a medical condition or are cutting weight for a fight, check with your coach.">
        Sample meal plan
      </Heading>
      <Card className="mb-4">
        <form className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-muted">Sex
              <select name="sex" defaultValue={sex} className={input}><option value="male">Male</option><option value="female">Female</option></select>
            </label>
            <label className="text-sm text-muted">Age<input name="age" inputMode="numeric" defaultValue={sp.age ?? ""} required className={input} /></label>
            <label className="text-sm text-muted">Weight (kg)<input name="kg" inputMode="decimal" defaultValue={Number.isFinite(kg) && kg ? kg : ""} required className={input} /></label>
            <label className="text-sm text-muted">Height (cm)<input name="cm" inputMode="numeric" defaultValue={sp.cm ?? ""} required className={input} /></label>
          </div>
          <label className="block text-sm text-muted">Activity
            <select name="activity" defaultValue={activity} className={input}>
              {ACTIVITY.map(([a, l]) => <option key={a} value={a}>{l}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-muted">Goal
              <select name="goal" defaultValue={goal} className={input}>
                <option value="lose">Lose fat</option><option value="maintain">Maintain</option><option value="gain">Build muscle</option>
              </select>
            </label>
            <label className="text-sm text-muted">Meals a day
              <select name="meals" defaultValue={meals} className={input}>{[3, 4, 5].map((m) => <option key={m} value={m}>{m}</option>)}</select>
            </label>
          </div>
          {coachTargets?.calories && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="use" value="coach" defaultChecked={sp.use === "coach"} className="h-5 w-5 accent-[var(--color-brand)]" />
              Use the targets my coach set ({coachTargets.calories} kcal)
            </label>
          )}
          <button className="min-h-12 w-full rounded-xl bg-brand font-extrabold uppercase text-white">Build my day</button>
        </form>
      </Card>
      {!t && Object.keys(sp).length > 0 && <Alert>Fill in age, weight and height to calculate.</Alert>}
      {t && plan && tot && (
        <>
          <div className="mb-3 grid grid-cols-4 gap-2 text-center">
            {([["kcal", t.calories, tot.calories], ["Protein", t.protein_g, tot.protein_g], ["Carbs", t.carbs_g, tot.carbs_g], ["Fat", t.fat_g, tot.fat_g]] as const).map(([l, target, got]) => (
              <div key={l} className="rounded-xl bg-surface-2 p-2">
                <p className="text-[10px] uppercase tracking-widest text-muted">{l}</p>
                <p className="font-black">{target}</p>
                <p className="text-[10px] text-muted">plan {got}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {plan.map((m) => (
              <Card key={m.name} className="!p-3">
                <div className="flex items-baseline justify-between">
                  <p className="font-black uppercase">{m.name}</p>
                  <p className="text-xs text-muted">{m.totals.calories} kcal · P{m.totals.protein_g} C{m.totals.carbs_g} F{m.totals.fat_g}</p>
                </div>
                <ul className="mt-1 text-sm">
                  {m.items.map((i) => (
                    <li key={i.food} className="flex justify-between">
                      <span>{i.food}</span>
                      <span className="text-muted">{i.grams} g</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          <form className="mt-3">
            {Object.entries(sp).filter(([k]) => k !== "v").map(([k, v]) => <input key={k} type="hidden" name={k} value={v ?? ""} />)}
            <input type="hidden" name="v" value={variant + 1} />
            <button className="min-h-11 w-full rounded-xl border border-line bg-surface-2 text-sm font-bold">Show different foods</button>
          </form>
        </>
      )}
      <ClientNavBar supabase={supabase} profile={profile} userId={user!.id} />
    </Screen>
  );
}
