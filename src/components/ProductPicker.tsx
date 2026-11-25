"use client";
// Meal library: search the AU product database, then "Add" puts the ingredient line
// (item | amount | brand) into the meal and adds its macros to the totals.
import { useMemo, useRef, useState } from "react";
import { amountText, isEstimate } from "@/lib/nutrition/products";

export interface FoodProduct {
  id: string;
  category: string;
  brand: string | null;
  name: string;
  serve: number | null;
  store: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
  verified: string | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function ProductPicker({ products }: { products: FoodProduct[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [qty, setQty] = useState("1");
  const [added, setAdded] = useState<string | null>(null);
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const words = t.split(/\s+/);
    return products.filter((p) => words.every((w) => `${p.brand ?? ""} ${p.name} ${p.category}`.toLowerCase().includes(w))).slice(0, 8);
  }, [q, products]);

  function add(p: FoodProduct) {
    const form = box.current?.closest("form");
    if (!form) return;
    const n = Math.max(0.25, Number(qty) || 1);
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
    const ing = field("ingredients");
    if (ing) {
      const line = [p.name, amountText(p, n), p.brand ?? ""].join(" | ").replace(/ \| $/, "");
      ing.value = ing.value.trim() ? `${ing.value.trim()}\n${line}` : line;
    }
    const bump = (name: string, v: number | null, dp = 1) => {
      const f = field(name);
      if (!f || v == null) return;
      const cur = Number(f.value) || 0;
      f.value = String(dp === 0 ? Math.round(cur + v * n) : r1(cur + v * n));
    };
    bump("kcal", p.kcal, 0);
    bump("protein_g", p.protein_g);
    bump("carbs_g", p.carbs_g);
    bump("fat_g", p.fat_g);
    setAdded(`${p.name} added${isEstimate(p.verified) ? " (estimated figures: check the label before a fight-week cut)" : ""}.`);
    setQ("");
  }

  return (
    <div ref={box} className="rounded-xl border border-line bg-surface-2 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Add from product database</p>
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search e.g. sunrice, chicken thigh, chobani" className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-text" aria-label="Search products" />
        <label className="flex items-center gap-1 text-xs text-muted">
          ×<input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-2 text-center text-text" aria-label="Serves" />
        </label>
      </div>
      {hits.length > 0 && (
        <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
          {hits.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => add(p)} className="w-full px-3 py-2 text-left hover:bg-surface-2">
                <span className="block text-sm font-bold">{p.name} <span className="font-normal text-muted">· {p.brand}</span></span>
                <span className="block text-xs text-muted">
                  {amountText(p, 1)} · {p.kcal ?? "?"} kcal · P {p.protein_g ?? "?"} · C {p.carbs_g ?? "?"} · F {p.fat_g ?? "?"}
                  {isEstimate(p.verified) && <span className="ml-1 font-bold text-warn">Estimated</span>}
                </span>
                {p.notes && <span className="block truncate text-[11px] text-muted/80">{p.notes}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && hits.length === 0 && <p className="mt-2 text-xs text-muted">No match. Type the ingredient line by hand below.</p>}
      {added && <p className="mt-2 text-xs font-bold text-ok">{added} Totals updated.</p>}
      <p className="mt-2 text-[11px] text-muted">Adds the ingredient with its brand and adds its calories and macros to the totals above (× serves).</p>
    </div>
  );
}
