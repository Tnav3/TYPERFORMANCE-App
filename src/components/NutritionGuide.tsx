"use client";
import { useState } from "react";
import {
  DAY_TYPES,
  nutritionFor,
  sampleDay,
  serves,
  validBodyweight,
  type DayType,
} from "@/lib/nutrition";
import { Card } from "./ui";

const range = ([a, b]: [number, number]) => `${a}–${b} g`;

export function NutritionGuide({
  defaultBodyweight,
}: {
  defaultBodyweight: number | null;
}) {
  const [bw, setBw] = useState(
    defaultBodyweight ? String(defaultBodyweight) : "",
  );
  const [day, setDay] = useState<DayType>("moderate");
  const kg = validBodyweight(bw);
  const plan = kg ? nutritionFor(kg, day) : null;
  const d = DAY_TYPES.find((x) => x.key === day)!;

  return (
    <>
      <Card className="mb-4">
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-semibold">
            Bodyweight (kg)
          </span>
          <input
            inputMode="decimal"
            value={bw}
            onChange={(e) => setBw(e.target.value)}
            placeholder="e.g. 72"
            className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text focus:border-brand focus:outline-none"
          />
          {bw && !kg && (
            <span className="mt-1 block text-sm text-brand">
              Enter a bodyweight between 35 and 200 kg
            </span>
          )}
        </label>
        <p className="mb-2 text-sm font-semibold">What does today look like?</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {DAY_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={day === t.key}
              onClick={() => setDay(t.key)}
              className={`min-h-14 rounded-xl border px-3 py-2 text-left transition ${
                day === t.key
                  ? "border-brand bg-brand/15"
                  : "border-line bg-surface-2"
              }`}
            >
              <span className="block text-sm font-extrabold">{t.label}</span>
              <span className="block text-xs text-muted">{t.hint}</span>
            </button>
          ))}
        </div>
      </Card>

      {plan && (
        <Card className="mb-4">
          <h2 className="mb-3 text-lg font-black uppercase">{d.label} day</h2>
          <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <b>For maintaining your weight.</b> These ranges fuel training at
            your current bodyweight; they aren&apos;t set up to gain or lose
            weight.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: "Carbs",
                g: plan.carbs,
                note: `${d.carbs[0]}–${d.carbs[1]} g/kg`,
              },
              { label: "Protein", g: plan.protein, note: "1.4–2.0 g/kg" },
              { label: "Fat", g: plan.fat, note: "25–30% of energy" },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-surface-2 p-3">
                <p className="text-xs uppercase tracking-widest text-muted">
                  {m.label}
                </p>
                <p className="text-lg font-black leading-tight">
                  {m.g[0]}–{m.g[1]}
                  <span className="text-sm font-bold"> g</span>
                </p>
                <p className="text-[11px] text-muted">{m.note}</p>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed">
            <li>
              <b>Spread your protein:</b> about {plan.proteinPerMeal} g at each
              of {plan.meals} meals or snacks, every 3–4 hours, including one
              soon after training.
            </li>
            <li>
              <b>Carbs follow your training:</b> eat more on the days and in the
              meals around your hardest sessions, less on rest days.
            </li>
            {plan.recoveryCarbsPerHour && (
              <li>
                <b>Training again within 8 hours?</b> Refuel fast: about{" "}
                {range(plan.recoveryCarbsPerHour)} of carbs per hour for the
                first 4 hours, with some protein.
              </li>
            )}
            <li>
              <b>Fat:</b> some at most meals (oils, nuts, eggs, avocado, fish),
              but keep it light in the snack before training so it sits well.
            </li>
          </ul>
        </Card>
      )}

      {plan && (
        <Card className="mb-4">
          <h2 className="mb-1 text-lg font-black uppercase">Sample day</h2>
          <p className="mb-3 text-sm text-muted">
            One way to split the middle of your ranges. Move meals around your
            own training time.
          </p>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 pr-2 font-semibold">Meal</th>
                <th className="py-1 text-right font-semibold">Carbs</th>
                <th className="py-1 text-right font-semibold">Protein</th>
                <th className="py-1 text-right font-semibold">Fat</th>
              </tr>
            </thead>
            <tbody>
              {sampleDay(plan, day).map((m) => (
                <tr key={m.name} className="border-t border-line align-top">
                  <td className="py-2 pr-2">
                    <span className="font-bold">{m.name}</span>
                    <span className="block text-xs text-muted">
                      ≈ {serves(m.carbs, 30)} carb · {serves(m.protein, 25)}{" "}
                      protein serves
                    </span>
                  </td>
                  <td className="py-2 text-right">{m.carbs} g</td>
                  <td className="py-2 text-right">{m.protein} g</td>
                  <td className="py-2 text-right">{m.fat} g</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">
            A carb serve is about 30 g (¾ cup cooked rice, 1 large banana); a
            protein serve is about 25 g (80 g cooked chicken, 4 eggs). See the
            FAQ for food swaps.
          </p>
        </Card>
      )}

      <Card className="mb-4 border-warn/50">
        <p className="text-sm leading-relaxed">
          <b>A general guide for healthy adults in training.</b> It isn&apos;t a
          meal plan and doesn&apos;t cover making weight. If you&apos;re cutting
          for a fight, have a medical condition, are pregnant, or have had a
          difficult relationship with food, talk to your coach and a sports
          dietitian first.
        </p>
      </Card>
      <details className="mb-6">
        <summary className="cursor-pointer text-xs text-muted underline underline-offset-4">
          Where these numbers come from
        </summary>
        <p className="mt-1 text-xs text-muted">
          Carbohydrate by training load and fast-refuel amounts: Thomas, Erdman
          &amp; Burke 2016, joint position statement of the American College of
          Sports Medicine, Academy of Nutrition and Dietetics and Dietitians of
          Canada; the same statement puts fat at 20–35% of energy, and this
          guide aims for the middle (25–30%). Protein 1.4–2.0 g/kg/day in doses
          of about 0.25 g/kg every 3–4 hours: Jäger et al. 2017, International
          Society of Sports Nutrition position stand. Meal splits are a worked
          example, not from a study.
        </p>
      </details>
    </>
  );
}
