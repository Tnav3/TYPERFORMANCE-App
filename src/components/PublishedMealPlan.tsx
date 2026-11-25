import Link from "next/link";
import { Card } from "@/components/ui";
import { DAYS, EATING_OUT, SPICES, mealsInDay, type DayKey, type Days, type LibraryMeal } from "@/lib/nutrition/plan-content";
import { sumMeals, type DayTargets } from "@/lib/nutrition/plan-calc";
import { PrintButton } from "@/components/PrintButton";

export interface MealSnapshot {
  title: string;
  targets: { train: DayTargets; rest: DayTargets };
  days: Days;
  meals: Record<string, LibraryMeal>;
  shopping: Record<string, string[]>;
  tips: string | null;
  substitutes: string | null;
}

function MealCard({ m, label }: { m: LibraryMeal; label: string }) {
  return (
    <div className="meal-card rounded-xl border border-line bg-surface p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-brand">{label}</div>
      <div className="font-bold">{m.name}</div>
      <div className="mb-2 text-xs text-muted">{m.kcal} kcal · P {Number(m.protein_g)}g · C {Number(m.carbs_g)}g · F {Number(m.fat_g)}g</div>
      {m.ingredients.length > 0 && (
        <ul className="mb-2 list-disc pl-5 text-sm">
          {m.ingredients.map((i, n) => <li key={n}>{[i.amount, i.item].filter(Boolean).join(" ")}{i.brand ? <span className="text-muted"> ({i.brand})</span> : null}</li>)}
        </ul>
      )}
      {m.steps.length > 0 && (
        <div className="text-sm">
          <div className="text-xs font-bold uppercase text-muted">Method</div>
          <ol className="list-decimal pl-5">{m.steps.map((s, n) => <li key={n}>{s}</li>)}</ol>
        </div>
      )}
      {m.note && <p className="mt-2 text-sm text-muted">{m.note}</p>}
      {m.family_note && <p className="mt-2 rounded-lg border-l-4 border-brand bg-surface-2 p-2 text-sm"><b>For the family:</b> {m.family_note}</p>}
    </div>
  );
}

export function PublishedMealPlan({ plan, day, publishedAt }: { plan: MealSnapshot; day: DayKey; publishedAt: string }) {
  const available = DAYS.filter(([k]) => mealsInDay(plan.days[k]).length);
  const current = available.find(([k]) => k === day) ?? available[0];
  const [key, , kind] = current;
  const d = plan.days[key] ?? {};
  const list = (id?: string | null) => (id ? plan.meals[id] : undefined);
  const chosen = mealsInDay(d).map((id) => plan.meals[id]).filter(Boolean);
  const tot = sumMeals(chosen.map((m) => ({ kcal: m.kcal, p: Number(m.protein_g), c: Number(m.carbs_g), f: Number(m.fat_g) })));
  const want = plan.targets[kind];

  return (
    <div className="meal-plan">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black">{plan.title}</h1>
          <p className="text-sm text-muted">From your coach · {publishedAt}</p>
        </div>
        <PrintButton />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
        {(["train", "rest"] as const).map((k) => (
          <Card key={k} className="!p-3">
            <div className="font-bold">{k === "train" ? "Training days" : "Rest days"}</div>
            <div className="text-muted">{plan.targets[k].kcal} kcal</div>
            <div className="text-xs text-muted">P {plan.targets[k].p}g · C {plan.targets[k].c}g · F {plan.targets[k].f}g</div>
          </Card>
        ))}
      </div>
      <div className="no-print mb-3 flex gap-2 overflow-x-auto">
        {available.map(([k, label]) => (
          <Link key={k} href={`/meal-plan?d=${k}`} className={`shrink-0 rounded-full border px-3 py-2 text-sm ${k === key ? "border-brand bg-brand text-white" : "border-line text-muted"}`}>
            {label.replace(" · ", " ")}
          </Link>
        ))}
      </div>
      <h2 className="print-only mb-2 text-lg font-black">{current[1]}</h2>
      <div className="space-y-3">
        {list(d.breakfast) && <MealCard m={list(d.breakfast)!} label="Breakfast" />}
        {list(d.lunch) && <MealCard m={list(d.lunch)!} label="Lunch" />}
        {list(d.dinner) && <MealCard m={list(d.dinner)!} label="Dinner" />}
        {(d.snacks ?? []).map((s, i) => list(s) && <MealCard key={s + i} m={list(s)!} label={`Snack ${i + 1}`} />)}
      </div>
      <p className="no-print mt-2 text-xs text-muted">This day: {tot.kcal} kcal · P {Math.round(tot.p)}g · C {Math.round(tot.c)}g · F {Math.round(tot.f)}g (target {want.kcal})</p>

      <div className="print-only">
        {available.filter(([k]) => k !== key).map(([k, label]) => {
          const o = plan.days[k] ?? {};
          return (
            <section key={k} className="print-break">
              <h2 className="mb-2 mt-4 text-lg font-black">{label}</h2>
              <div className="space-y-3">
                {list(o.breakfast) && <MealCard m={list(o.breakfast)!} label="Breakfast" />}
                {list(o.lunch) && <MealCard m={list(o.lunch)!} label="Lunch" />}
                {list(o.dinner) && <MealCard m={list(o.dinner)!} label="Dinner" />}
                {(o.snacks ?? []).map((sn, i) => list(sn) && <MealCard key={sn + i} m={list(sn)!} label={`Snack ${i + 1}`} />)}
              </div>
            </section>
          );
        })}
      </div>
      {plan.tips && <Card className="mt-4"><h2 className="mb-1 font-bold">Tips</h2><p className="whitespace-pre-line text-sm">{plan.tips}</p></Card>}
      {plan.substitutes && <Card className="mt-4"><h2 className="mb-1 font-bold">Swaps you can make</h2><p className="whitespace-pre-line text-sm">{plan.substitutes}</p></Card>}
      <Card className="mt-4">
        <h2 className="mb-2 font-bold">Eating out</h2>
        <ul className="space-y-1 text-sm">{EATING_OUT.map(([w, how]) => <li key={w}><b>{w}:</b> {how}</li>)}</ul>
      </Card>
      <Card className="mt-4 print-break">
        <h2 className="mb-2 font-bold">Shopping list</h2>
        {Object.entries(plan.shopping).filter(([, v]) => v.length).map(([g, items]) => (
          <div key={g} className="mb-2">
            <div className="text-xs font-bold uppercase text-brand">{g}</div>
            <ul className="text-sm">{items.map((i) => <li key={i}>☐ {i}</li>)}</ul>
          </div>
        ))}
        <div className="text-xs font-bold uppercase text-brand">Spice pantry</div>
        <p className="text-sm">{SPICES.join(", ")}</p>
      </Card>
    </div>
  );
}
