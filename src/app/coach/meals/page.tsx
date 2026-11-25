import Link from "next/link";
import { requireState } from "@/lib/session";
import { Alert, Card, Heading, Screen } from "@/components/ui";
import { ingredientsText, type LibraryMeal } from "@/lib/nutrition/plan-content";
import { deleteMeal, saveMeal } from "./actions";
import { ProductPicker, type FoodProduct } from "@/components/ProductPicker";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const area = "w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const SLOTS: [string, string][] = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snack"]];

function MealForm({ m, products }: { m?: LibraryMeal; products: FoodProduct[] }) {
  return (
    <form action={saveMeal} className="space-y-3">
      {m && <input type="hidden" name="id" value={m.id} />}
      <input type="hidden" name="back" value={m ? `/coach/meals?edit=${m.id}` : "/coach/meals?new=1"} />
      <input name="name" defaultValue={m?.name} required placeholder="Crispy skin chicken thigh with broccolini" className={input} />
      <select name="slot" defaultValue={m?.slot ?? "dinner"} className={input}>
        {SLOTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <div className="grid grid-cols-4 gap-2">
        {([["kcal", "kcal"], ["protein_g", "P (g)"], ["carbs_g", "C (g)"], ["fat_g", "F (g)"]] as const).map(([k, l]) => (
          <label key={k} className="text-xs text-muted">{l}
            <input name={k} inputMode="decimal" required defaultValue={m ? String(m[k]) : ""} className={input} />
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">Use your AU database numbers. The app checks P×4 + C×4 + F×9 matches the calories.</p>
      {products.length > 0 && <ProductPicker products={products} />}
      <label className="block text-sm text-muted">Ingredients, one per line: item | amount | brand
        <textarea name="ingredients" rows={5} defaultValue={m ? ingredientsText(m.ingredients) : ""} placeholder={"Chicken thigh, skin on | 150 g | Lilydale\nBroccolini | 1 bunch"} className={area} />
      </label>
      <label className="block text-sm text-muted">Method, one step per line
        <textarea name="steps" rows={4} defaultValue={m?.steps.join("\n")} className={area} />
      </label>
      <input name="note" defaultValue={m?.note ?? ""} placeholder="Coach note (optional), e.g. why this meal works" className={input} />
      <input name="family_note" defaultValue={m?.family_note ?? ""} placeholder="For the family (optional), e.g. add rice for the kids" className={input} />
      <input name="tags" defaultValue={m?.tags.join(", ")} placeholder="Tags: gluten free, quick, keto" className={input} />
      <button className="min-h-11 w-full rounded-xl bg-brand font-bold text-white">{m ? "Save meal" : "Add meal"}</button>
    </form>
  );
}

export default async function MealLibraryPage({ searchParams }: { searchParams: Promise<{ error?: string; edit?: string; new?: string; slot?: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const sp = await searchParams;
  const [{ data }, { data: prodRows }] = await Promise.all([
    supabase.from("meal_library").select("*").order("slot").order("name"),
    supabase.from("food_products").select("id, category, brand, name, serve, store, kcal, protein_g, carbs_g, fat_g, notes, verified").order("category").order("name"),
  ]);
  const products = ((prodRows ?? []) as FoodProduct[]).map((p) => ({ ...p, serve: p.serve != null ? Number(p.serve) : null, kcal: p.kcal != null ? Number(p.kcal) : null, protein_g: p.protein_g != null ? Number(p.protein_g) : null, carbs_g: p.carbs_g != null ? Number(p.carbs_g) : null, fat_g: p.fat_g != null ? Number(p.fat_g) : null }));
  const meals = (data ?? []) as LibraryMeal[];
  const slot = SLOTS.some(([k]) => k === sp.slot) ? sp.slot : null;
  const shown = slot ? meals.filter((m) => m.slot === slot) : meals;
  const editing = meals.find((m) => m.id === sp.edit);

  return (
    <Screen wide>
      <Heading sub="Your meals with AU macros. Plans are built from these, and the shopping list comes from the ingredients.">Meal library</Heading>
      {sp.error && <Alert>{sp.error}</Alert>}
      {editing ? (
        <Card className="mb-4 lg:max-w-2xl">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Edit meal</h2><Link href="/coach/meals" className="text-sm text-muted">Cancel</Link></div>
          <MealForm m={editing} products={products} />
          <form action={deleteMeal} className="mt-3"><input type="hidden" name="id" value={editing.id} /><button className="text-sm text-red-400">Delete meal</button></form>
        </Card>
      ) : (
        <details className="mb-4 lg:max-w-2xl" open={!!sp.new || meals.length === 0}>
          <summary className="min-h-11 cursor-pointer rounded-xl border border-line bg-surface px-4 py-3 font-bold">+ Add a meal</summary>
          <Card className="mt-2"><MealForm products={products} /></Card>
        </details>
      )}
      <div className="mb-3 flex gap-2 overflow-x-auto">
        <Link href="/coach/meals" className={`rounded-full border px-3 py-1 text-sm ${!slot ? "border-brand text-text" : "border-line text-muted"}`}>All ({meals.length})</Link>
        {SLOTS.map(([k, l]) => (
          <Link key={k} href={`/coach/meals?slot=${k}`} className={`rounded-full border px-3 py-1 text-sm ${slot === k ? "border-brand text-text" : "border-line text-muted"}`}>
            {l} ({meals.filter((m) => m.slot === k).length})
          </Link>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((m) => (
          <Link key={m.id} href={`/coach/meals?edit=${m.id}`} className="block rounded-xl border border-line bg-surface p-3">
            <div className="font-semibold">{m.name}</div>
            <div className="text-xs text-muted">{m.slot} · {m.kcal} kcal · P {Number(m.protein_g)} · C {Number(m.carbs_g)} · F {Number(m.fat_g)}{m.tags.length ? ` · ${m.tags.join(", ")}` : ""}</div>
          </Link>
        ))}
        {shown.length === 0 && <p className="text-sm text-muted">No meals yet.</p>}
      </div>
    </Screen>
  );
}
