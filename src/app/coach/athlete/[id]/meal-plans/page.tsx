import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientTabs } from "@/components/ClientTabs";
import { requireState } from "@/lib/session";
import { bodyweights } from "@/lib/programming/history-data";
import { formatDate, todayISO } from "@/lib/dates";
import { Alert, Card, Screen } from "@/components/ui";
import { ACTIVITY_LEVELS, PLAN_TYPES, sumMeals, type DayTargets } from "@/lib/nutrition/plan-calc";
import { DAYS, type Days, type LibraryMeal } from "@/lib/nutrition/plan-content";
import { createMealPlan, deleteMealPlan, publishMealPlan, saveDays, saveTargets } from "@/app/coach/meals/actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const area = "w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-text focus:border-brand focus:outline-none";

function ageFrom(birthday: string | null) {
  if (!birthday) return "";
  const t = todayISO();
  let a = Number(t.slice(0, 4)) - Number(birthday.slice(0, 4));
  if (t.slice(5) < birthday.slice(5)) a -= 1;
  return String(a);
}

function Bar({ got, want, label }: { got: number; want: number; label: string }) {
  const diff = Math.round(got - want);
  const off = want ? Math.abs(diff) / want : 0;
  return (
    <div className="text-xs">
      <span className="text-muted">{label} </span>
      <span className={off <= 0.05 ? "text-green-400" : off <= 0.1 ? "text-yellow-400" : "text-red-400"}>
        {Math.round(got)}/{want} ({diff >= 0 ? "+" : ""}{diff})
      </span>
    </div>
  );
}

export default async function ClientMealPlansPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plan?: string; error?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const sp = await searchParams;
  const [{ data: client }, { data: plans }, { data: lib }, weights] = await Promise.all([
    supabase.from("profiles").select("full_name, sex, birthday").eq("id", id).maybeSingle(),
    supabase.from("meal_plans").select("*").eq("athlete_id", id).order("created_at", { ascending: false }),
    supabase.from("meal_library").select("*").order("name"),
    bodyweights(supabase, id, 1),
  ]);
  if (!client) notFound();
  const meals = (lib ?? []) as LibraryMeal[];
  const byId = Object.fromEntries(meals.map((m) => [m.id, m]));
  const plan = (plans ?? []).find((p) => p.id === sp.plan);
  const name = client.full_name ?? "Client";

  if (!plan) {
    return (
      <Screen>
        <ClientTabs id={id} name={name} active="meals" />
        {sp.error && <Alert>{sp.error}</Alert>}
        <div className="space-y-2">
          {(plans ?? []).map((p) => (
            <Link key={p.id} href={`?plan=${p.id}`} className="flex items-center justify-between rounded-xl border border-line bg-surface p-3">
              <span className="font-semibold">{p.title}</span>
              <span className={`text-xs ${p.status === "published" ? "text-green-400" : "text-muted"}`}>
                {p.status === "published" ? `Live since ${formatDate(p.published_at.slice(0, 10))}` : p.status}
              </span>
            </Link>
          ))}
        </div>
        <Card className="mt-4">
          <h2 className="mb-1 font-bold">New meal plan</h2>
          <p className="mb-3 text-sm text-muted">Mifflin-St Jeor with your plan rules. You can change every number after.</p>
          {meals.length < 4 && (
            <p className="mb-3 text-sm text-yellow-400">
              Your <Link href="/coach/meals" className="underline">meal library</Link> has {meals.length} meals. Add some before building days.
            </p>
          )}
          <form action={createMealPlan} className="space-y-3">
            <input type="hidden" name="athlete_id" value={id} />
            <select name="type" className={input} defaultValue="standard_loss">
              {PLAN_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm text-muted">Sex
                <select name="sex" defaultValue={client.sex === "female" ? "female" : "male"} className={input}><option value="male">Male</option><option value="female">Female</option></select>
              </label>
              <label className="text-sm text-muted">Age<input name="age" inputMode="numeric" defaultValue={ageFrom(client.birthday)} required className={input} /></label>
              <label className="text-sm text-muted">Weight (kg)<input name="kg" inputMode="decimal" defaultValue={weights[0]?.kg || ""} required className={input} /></label>
              <label className="text-sm text-muted">Height (cm)<input name="cm" inputMode="numeric" required className={input} /></label>
            </div>
            <select name="activity" defaultValue="moderate" className={input}>
              {ACTIVITY_LEVELS.map(([k, , l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input name="dietary" placeholder="Dietary needs: coeliac, dislikes, cultural (for your reference)" className={input} />
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="breastfeeding" className="h-5 w-5" /> Breastfeeding (+500 kcal)</label>
            <input name="title" placeholder="Title (optional)" className={input} />
            <button className="min-h-11 w-full rounded-xl bg-brand font-bold text-white">Work out targets</button>
          </form>
        </Card>
      </Screen>
    );
  }

  const t = plan.targets as { tdee?: number; train: DayTargets; rest: DayTargets; flags?: string[]; rate?: number | null };
  const days = (plan.days ?? {}) as Days;
  const bySlot = (s: string) => meals.filter((m) => m.slot === s);
  const SlotSelect = ({ day, slot, value }: { day: string; slot: string; value?: string | null }) => (
    <select name={`${day}_${slot}`} defaultValue={value ?? ""} className={input}>
      <option value="">{slot[0].toUpperCase() + slot.slice(1)}: none</option>
      {bySlot(slot).map((m) => <option key={m.id} value={m.id}>{m.name} ({m.kcal})</option>)}
    </select>
  );

  return (
    <Screen>
      <ClientTabs id={id} name={name} active="meals" />
      <Link href={`/coach/athlete/${id}/meal-plans`} className="mb-2 inline-block text-sm text-muted">← All plans</Link>
      {sp.error && <Alert>{sp.error}</Alert>}
      <h2 className="mb-1 text-xl font-bold">{plan.title}</h2>
      <p className="mb-3 text-sm text-muted">
        {plan.status === "published" ? "Live for the client." : "Draft. The client can't see this yet."} TDEE {t.tdee ?? "?"} kcal
        {t.rate != null ? ` · about ${t.rate} kg/week` : ""}
      </p>
      {(t.flags ?? []).map((f) => <Alert key={f}>{f}</Alert>)}

      <Card className="mb-4">
        <h3 className="mb-2 font-bold">Targets</h3>
        <form action={saveTargets} className="space-y-2">
          <input type="hidden" name="plan_id" value={plan.id} />
          <input type="hidden" name="athlete_id" value={id} />
          {(["train", "rest"] as const).map((k) => (
            <div key={k}>
              <div className="text-sm font-semibold">{k === "train" ? "Training day" : "Rest day"} · {t[k].kcal} kcal</div>
              <div className="grid grid-cols-3 gap-2">
                {(["p", "c", "f"] as const).map((m) => (
                  <label key={m} className="text-xs text-muted">{m === "p" ? "Protein" : m === "c" ? "Carbs" : "Fat"} (g)
                    <input name={`${k}_${m}`} inputMode="numeric" defaultValue={t[k][m]} className={input} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button className="min-h-11 w-full rounded-xl border border-line bg-surface-2 font-bold">Save targets</button>
        </form>
      </Card>

      <form action={saveDays} id="days" className="space-y-4">
        <input type="hidden" name="plan_id" value={plan.id} />
        <input type="hidden" name="athlete_id" value={id} />
        {DAYS.map(([k, label, kind]) => {
          const d = days[k] ?? {};
          const chosen = [d.breakfast, d.lunch, d.dinner, ...(d.snacks ?? [])].map((x) => (x ? byId[x] : null)).filter(Boolean) as LibraryMeal[];
          const tot = sumMeals(chosen.map((m) => ({ kcal: m.kcal, p: Number(m.protein_g), c: Number(m.carbs_g), f: Number(m.fat_g) })));
          const want = t[kind];
          return (
            <Card key={k}>
              <h3 className="mb-2 font-bold">{label}</h3>
              <div className="space-y-2">
                <SlotSelect day={k} slot="breakfast" value={d.breakfast} />
                <SlotSelect day={k} slot="lunch" value={d.lunch} />
                <SlotSelect day={k} slot="dinner" value={d.dinner} />
                {[0, 1].map((i) => (
                  <select key={i} name={`${k}_snack`} defaultValue={d.snacks?.[i] ?? ""} className={input}>
                    <option value="">Snack {i + 1}: none</option>
                    {bySlot("snack").map((m) => <option key={m.id} value={m.id}>{m.name} ({m.kcal})</option>)}
                  </select>
                ))}
              </div>
              {chosen.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-2">
                  <Bar label="kcal" got={tot.kcal} want={want.kcal} />
                  <Bar label="P" got={tot.p} want={want.p} />
                  <Bar label="C" got={tot.c} want={want.c} />
                  <Bar label="F" got={tot.f} want={want.f} />
                </div>
              )}
            </Card>
          );
        })}
        <Card>
          <label className="block text-sm text-muted">Tips for this client
            <textarea name="tips" rows={5} defaultValue={plan.tips ?? ""} placeholder="Eat 3 of your 4 meals at home. Prep protein on Sunday." className={area} />
          </label>
          <label className="mt-3 block text-sm text-muted">Substitutes
            <textarea name="substitutes" rows={4} defaultValue={plan.substitutes ?? ""} placeholder="Chicken thigh → lean beef mince or barramundi" className={area} />
          </label>
        </Card>
        <button className="min-h-11 w-full rounded-xl border border-line bg-surface-2 font-bold">Save days</button>
      </form>
      <p className="mt-2 text-xs text-muted">Green is within 5% of target, yellow within 10%. Save before publishing.</p>

      <form action={publishMealPlan} className="mt-4">
        <input type="hidden" name="plan_id" value={plan.id} />
        <input type="hidden" name="athlete_id" value={id} />
        <button className="min-h-11 w-full rounded-xl bg-brand font-bold text-white">
          {plan.status === "published" ? "Republish with changes" : "Publish to client"}
        </button>
      </form>
      <div className="mt-3 flex justify-between text-sm">
        {plan.status === "published" && <Link href={`/view-as/${id}?next=/meal-plan`} className="text-muted underline">Preview as client</Link>}
        <form action={deleteMealPlan}>
          <input type="hidden" name="plan_id" value={plan.id} />
          <input type="hidden" name="athlete_id" value={id} />
          <button className="text-red-400">Delete plan</button>
        </form>
      </div>
    </Screen>
  );
}
