import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { priceLabel, type Billing } from "@/lib/shop";
import { removeProduct, sellProgram, updateProduct } from "./actions";

export const dynamic = "force-dynamic";
const input = "min-h-10 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-text";
const label = "block text-xs font-bold uppercase tracking-wide text-muted";

type Product = {
  id: string; program_id: string; slug: string; title: string; tagline: string | null; description: string | null;
  price_cents: number; currency: string; billing: Billing; billing_count: number | null; checkout_url: string | null;
  match_name: string | null; start_rule: string; weeks: number | null; sessions_per_week: number | null; active: boolean;
};

export default async function ShopAdmin({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const [{ data: prods, error: tableErr }, { data: programs }, { data: folders }, { data: orders }] = await Promise.all([
    supabase.from("shop_products").select("*").order("sort_order").order("title"),
    supabase.from("programs").select("id, name, weeks, folder_id").eq("archived", false).order("name"),
    supabase.from("program_folders").select("id, name, parent_id"),
    supabase.from("shop_purchases").select("id, email, status, created_at, product_id").order("created_at", { ascending: false }).limit(30),
  ]);
  if (tableErr) {
    return (
      <Screen>
        <BackLink href="/coach" label="Dashboard" />
        <Heading>Program shop</Heading>
        <Alert>The shop needs a database update (migration 098) before it can be used.</Alert>
      </Screen>
    );
  }
  const products = (prods ?? []) as Product[];
  const selling = new Set(products.map((p) => p.program_id));
  const fName = new Map((folders ?? []).map((f) => [f.id, f.name as string]));
  const fParent = new Map((folders ?? []).map((f) => [f.id, f.parent_id as string | null]));
  const path = (id: string | null) => {
    const parts: string[] = [];
    for (let f = id; f; f = fParent.get(f) ?? null) parts.unshift(fName.get(f) ?? "");
    return parts.join(" / ") || "No folder";
  };
  const grouped = new Map<string, { id: string; name: string; weeks: number | null }[]>();
  for (const p of programs ?? []) {
    if (selling.has(p.id)) continue;
    const k = path(p.folder_id);
    grouped.set(k, [...(grouped.get(k) ?? []), p]);
  }
  const prodTitle = new Map(products.map((p) => [p.id, p.title]));
  const sales = new Map<string, number>();
  for (const o of orders ?? []) sales.set(o.product_id, (sales.get(o.product_id) ?? 0) + 1);

  return (
    <Screen wide>
      <BackLink href="/coach" label="Dashboard" />
      <Heading sub="Sell pre-built programs. Buyers pay through MxP, then get an app account and their program automatically.">Program shop</Heading>
      {error && <Alert>{error}</Alert>}
      {saved && !error && <Alert tone="ok">Saved.</Alert>}
      <p className="mb-5 text-sm">
        <Link href="/shop" className="font-bold text-brand underline underline-offset-4">See your shop as a buyer →</Link>
        <span className="ml-2 text-muted">Only programs switched to “On sale” show there.</span>
      </p>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Your products · {products.length}</h2>
      <div className="mb-8 space-y-2">
        {products.map((p) => (
          <details key={p.id} id={`p-${p.id}`} className="scroll-mt-4 rounded-2xl border border-line bg-surface p-4 open:border-brand/50">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="font-extrabold">{p.title}</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {p.price_cents ? priceLabel(p.price_cents, p.currency, p.billing, p.billing_count) : "No price yet"}
                  {p.weeks ? ` · ${p.weeks} weeks` : ""}
                  {p.sessions_per_week ? ` · ${p.sessions_per_week} sessions a week` : ""}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs font-bold">
                {sales.get(p.id) ? <span className="text-muted">{sales.get(p.id)} sold</span> : null}
                <span className={`rounded-full px-2 py-0.5 ${p.active ? "bg-ok/15 text-ok" : "bg-surface-2 text-muted"}`}>{p.active ? "On sale" : "Hidden"}</span>
              </span>
            </summary>
            <form action={updateProduct} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={p.id} />
              <label className="sm:col-span-2"><span className={label}>Name in the shop</span><input name="title" defaultValue={p.title} required maxLength={80} className={input} /></label>
              <label className="sm:col-span-2"><span className={label}>One-line pitch</span><input name="tagline" defaultValue={p.tagline ?? ""} maxLength={160} className={input} placeholder="3 days a week for 8 weeks: hit harder for longer." /></label>
              <label className="sm:col-span-2"><span className={label}>Description</span><textarea name="description" defaultValue={p.description ?? ""} maxLength={4000} rows={6} className={input} /></label>
              <label><span className={label}>Price ($)</span><input name="price" inputMode="decimal" defaultValue={p.price_cents ? (p.price_cents / 100).toFixed(2) : ""} placeholder="14.99" className={input} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label><span className={label}>Billed</span>
                  <select name="billing" defaultValue={p.billing} className={input}>
                    <option value="once">Once</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                  </select>
                </label>
                <label><span className={label}>For how many</span><input name="billing_count" type="number" min={1} max={104} defaultValue={p.billing_count ?? ""} placeholder="8" className={input} /></label>
              </div>
              <label className="sm:col-span-2"><span className={label}>MxP or Stripe checkout link</span><input name="checkout_url" type="url" defaultValue={p.checkout_url ?? ""} placeholder="https://…" className={input} /></label>
              <label><span className={label}>Product name in MxP</span><input name="match_name" defaultValue={p.match_name ?? ""} maxLength={100} className={input} placeholder="Exactly as MxP sends it" /></label>
              <label><span className={label}>Program starts</span>
                <select name="start_rule" defaultValue={p.start_rule} className={input}>
                  <option value="next_monday">Next Monday</option><option value="purchase">The day they buy</option>
                </select>
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm font-bold sm:col-span-2">
                <input type="checkbox" name="active" defaultChecked={p.active} className="h-5 w-5 accent-[#D2141E]" /> On sale (shows in your shop)
              </label>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <button className="min-h-11 rounded-xl bg-brand px-5 text-sm font-extrabold uppercase text-white">Save</button>
                <Link href={`/coach/programs/${p.program_id}`} className="text-sm font-bold text-muted underline underline-offset-4">Edit the program</Link>
                {p.active && <Link href={`/shop/${p.slug}`} className="text-sm font-bold text-muted underline underline-offset-4">View page</Link>}
              </div>
            </form>
            <form action={removeProduct} className="mt-3">
              <input type="hidden" name="id" value={p.id} />
              <button className="text-xs font-bold text-muted underline underline-offset-4">Stop selling this program</button>
            </form>
          </details>
        ))}
        {products.length === 0 && <p className="text-sm text-muted">Nothing for sale yet. Pick a program below.</p>}
      </div>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Sell another program</h2>
      <form action={sellProgram} className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-4">
        <select name="program_id" required defaultValue="" className={`${input} min-w-0 flex-1`} aria-label="Program to sell">
          <option value="" disabled>Choose from your program folders…</option>
          {[...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([folder, list]) => (
            <optgroup key={folder} label={folder}>
              {list.map((p) => <option key={p.id} value={p.id}>{p.name}{p.weeks && !/\(\d+ wk\)$/.test(p.name) ? ` (${p.weeks} wk)` : ""}</option>)}
            </optgroup>
          ))}
        </select>
        <button className="min-h-10 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Add to shop</button>
        <p className="w-full text-xs text-muted">It starts hidden. Set a price and checkout link, then switch it on.</p>
      </form>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Recent orders</h2>
      <div className="mb-8 overflow-hidden rounded-2xl border border-line bg-surface">
        {(orders ?? []).map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 border-b border-line p-3 text-sm last:border-0">
            <span className="min-w-0 truncate"><b>{prodTitle.get(o.product_id) ?? "Program"}</b> · {o.email}</span>
            <span className="shrink-0 text-xs text-muted">{o.status === "fulfilled" ? "Program assigned" : "Waiting for sign-up"} · {formatDate(o.created_at.slice(0, 10))}</span>
          </div>
        ))}
        {!orders?.length && <p className="p-3 text-sm text-muted">No orders yet.</p>}
      </div>

      <details className="rounded-2xl border border-line bg-surface p-4 text-sm">
        <summary className="cursor-pointer list-none font-extrabold">How to connect MxP (one time) ▾</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>In MxP, create a product and a payment link (or order form) for each program. Paste the link into “MxP or Stripe checkout link” above.</li>
          <li>Type the product name exactly as MxP has it into “Product name in MxP”, so the app knows which program they bought.</li>
          <li>The webhook you set up for coaching payments also handles the shop: <code>POST /api/ghl/payments</code> with the <code>x-typ-secret</code> header, triggered by “Payment received” / “Order submitted”, sending <code>{"{"}&quot;event&quot;: &quot;payment_received&quot;, &quot;email&quot;: &quot;{"{{contact.email}}"}&quot;, &quot;plan&quot;: &quot;{"{{order.product_name}}"}&quot;{"}"}</code>.</li>
          <li>When they pay, the app records the order. If they already have an account, the program is assigned straight away. If not, they&apos;re invited, and the program is assigned the moment they sign up with the same email.</li>
          <li>Failed or cancelled payments use the same rules as coaching: chat stays open, everything else pauses until they pay.</li>
        </ol>
      </details>
    </Screen>
  );
}
