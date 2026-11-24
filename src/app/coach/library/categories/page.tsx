import { requireState } from "@/lib/session";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";
import { loadCategories } from "@/lib/programming/categories-data";
import { addCategory, addSubcategory, deleteCategory, renameCategory } from "./actions";

export const dynamic = "force-dynamic";
const input = "min-h-10 w-full min-w-0 rounded-lg border border-line bg-surface-2 px-2 text-sm text-text focus:border-brand focus:outline-none";
const small = "min-h-10 shrink-0 rounded-lg border border-line bg-surface-2 px-3 text-xs font-bold";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const { error } = await searchParams;
  const [cats, { data: rows }] = await Promise.all([loadCategories(supabase), supabase.from("exercises").select("category, subcategory").eq("active", true)]);
  const count = new Map<string, number>();
  for (const r of rows ?? []) {
    count.set(r.category, (count.get(r.category) ?? 0) + 1);
    if (r.subcategory) count.set(`${r.category}.${r.subcategory}`, (count.get(`${r.category}.${r.subcategory}`) ?? 0) + 1);
  }
  return (
    <Screen wide>
      <BackLink href="/coach/library" label="Exercise library" />
      <Heading sub="Rename, add or remove categories and subcategories. One can only be removed once no exercises use it.">Categories</Heading>
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cats.cats.map(([c, label]) => (
          <section key={c} className="rounded-2xl border border-line bg-surface p-3">
            <form action={renameCategory} className="flex gap-1">
              <input type="hidden" name="category" value={c} />
              <input name="label" defaultValue={label} maxLength={40} required className={`${input} font-extrabold`} aria-label="Category name" />
              <button className={small}>Save</button>
            </form>
            <p className="mt-1 text-xs text-muted">{count.get(c) ?? 0} exercises</p>
            <ul className="mt-2 space-y-1">
              {(cats.subs[c] ?? []).map(([k, l]) => (
                <li key={k} className="flex items-center gap-1">
                  <form action={renameCategory} className="flex min-w-0 flex-1 gap-1">
                    <input type="hidden" name="category" value={c} />
                    <input type="hidden" name="sub" value={k} />
                    <input name="label" defaultValue={l} maxLength={40} required className={input} aria-label="Subcategory name" />
                    <button className={small}>Save</button>
                  </form>
                  <span className="w-8 shrink-0 text-right text-xs text-muted">{count.get(`${c}.${k}`) ?? 0}</span>
                  <form action={deleteCategory}>
                    <input type="hidden" name="category" value={c} />
                    <input type="hidden" name="sub" value={k} />
                    <button className="min-h-10 px-2 text-xs font-bold text-muted hover:text-brand" aria-label={`Remove ${l}`}>✕</button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={addSubcategory} className="mt-2 flex gap-1">
              <input type="hidden" name="category" value={c} />
              <input name="label" placeholder="+ New subcategory" maxLength={40} required className={input} aria-label="New subcategory" />
              <button className={small}>Add</button>
            </form>
            {!(count.get(c) ?? 0) && (
              <form action={deleteCategory} className="mt-2 text-right">
                <input type="hidden" name="category" value={c} />
                <button className="min-h-9 text-xs font-bold text-brand underline underline-offset-4">Remove category</button>
              </form>
            )}
          </section>
        ))}
        <form action={addCategory} className="flex items-start gap-1 rounded-2xl border border-dashed border-line p-3">
          <input name="label" placeholder="+ New category, e.g. Mobility & flexibility" maxLength={40} required className={input} aria-label="New category" />
          <button className={small}>Add</button>
        </form>
      </div>
    </Screen>
  );
}
