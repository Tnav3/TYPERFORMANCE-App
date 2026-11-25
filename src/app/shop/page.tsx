import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Logo, Screen } from "@/components/ui";
import { priceLabel, type Billing } from "@/lib/shop";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Programs · TYPERFORMANCE", description: "Strength and conditioning programs for combat athletes, delivered in the TYPERFORMANCE app." };

type P = { slug: string; title: string; tagline: string | null; price_cents: number; currency: string; billing: Billing; billing_count: number | null; weeks: number | null; sessions_per_week: number | null };

export default async function Shop() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_products")
    .select("slug, title, tagline, price_cents, currency, billing, billing_count, weeks, sessions_per_week")
    .eq("active", true)
    .order("sort_order")
    .order("title");
  const list = (data ?? []) as P[];
  return (
    <Screen>
      <header className="mb-6 flex items-center gap-3">
        <Logo size={40} />
        <div>
          <h1 className="text-2xl font-black uppercase leading-none tracking-tight">Programs</h1>
          <p className="mt-1 text-sm text-muted">Built for fighters. Delivered in the TYPERFORMANCE app.</p>
        </div>
      </header>
      <div className="space-y-3">
        {list.map((p) => (
          <Link key={p.slug} href={`/shop/${p.slug}`} className="block rounded-2xl border border-line bg-surface p-5 transition hover:border-brand">
            <h2 className="text-lg font-black uppercase leading-tight">{p.title}</h2>
            {p.tagline && <p className="mt-1 text-sm">{p.tagline}</p>}
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-wide text-muted">
              {p.weeks && <span>{p.weeks} weeks</span>}
              {p.sessions_per_week ? <span>{p.sessions_per_week} sessions a week</span> : null}
            </p>
            <p className="mt-3 flex items-center justify-between gap-3">
              <span className="font-extrabold text-brand">{priceLabel(p.price_cents, p.currency, p.billing, p.billing_count)}</span>
              <span className="text-sm font-bold">See program →</span>
            </p>
          </Link>
        ))}
        {list.length === 0 && <p className="rounded-2xl border border-line bg-surface p-5 text-muted">New programs are on the way. Check back soon.</p>}
      </div>
      <p className="mt-8 text-center text-xs text-muted">
        Already a client? <Link href="/login" className="font-bold underline underline-offset-4">Sign in</Link>
      </p>
    </Screen>
  );
}
