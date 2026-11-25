import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LinkedText } from "@/components/LinkedText";
import { BackLink, Logo, Screen } from "@/components/ui";
import { priceLabel, totalCents, type Billing } from "@/lib/shop";

export const dynamic = "force-dynamic";

type P = { slug: string; title: string; tagline: string | null; description: string | null; price_cents: number; currency: string; billing: Billing; billing_count: number | null; checkout_url: string | null; start_rule: string; weeks: number | null; sessions_per_week: number | null };

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_products")
    .select("slug, title, tagline, description, price_cents, currency, billing, billing_count, checkout_url, start_rule, weeks, sessions_per_week")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return data as P | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: `${p.title} · TYPERFORMANCE`, description: p.tagline ?? undefined } : { title: "Program · TYPERFORMANCE" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const total = totalCents(p.price_cents, p.billing, p.billing_count);
  return (
    <Screen>
      <BackLink href="/shop" label="All programs" />
      <div className="mb-4 flex items-center gap-3">
        <Logo size={32} />
        <span className="text-xs font-bold uppercase tracking-widest text-muted">TYPERFORMANCE</span>
      </div>
      <h1 className="text-3xl font-black uppercase leading-none tracking-tight">{p.title}</h1>
      {p.tagline && <p className="mt-2 text-lg">{p.tagline}</p>}
      <div className="my-5 grid grid-cols-2 gap-2 text-center">
        {p.weeks && <div className="rounded-2xl border border-line bg-surface p-3"><p className="text-2xl font-black">{p.weeks}</p><p className="text-xs uppercase tracking-wide text-muted">weeks</p></div>}
        {p.sessions_per_week ? <div className="rounded-2xl border border-line bg-surface p-3"><p className="text-2xl font-black">{p.sessions_per_week}</p><p className="text-xs uppercase tracking-wide text-muted">sessions a week</p></div> : null}
      </div>
      <div className="mb-6 rounded-2xl border border-brand/50 bg-surface p-5">
        <p className="text-xl font-black">{priceLabel(p.price_cents, p.currency, p.billing, p.billing_count)}</p>
        {total != null && p.billing !== "once" && <p className="text-sm text-muted">${(total / 100).toFixed(2)} {p.currency} in total</p>}
        {p.checkout_url ? (
          <a href={p.checkout_url} rel="noopener" className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-brand text-base font-extrabold uppercase text-white">
            Get the program
          </a>
        ) : (
          <p className="mt-4 rounded-xl bg-surface-2 p-3 text-center text-sm font-bold text-muted">Coming soon</p>
        )}
        <p className="mt-3 text-xs text-muted">
          After you pay, sign up in the app with the same email. Your program is waiting for you
          {p.start_rule === "next_monday" ? ", starting the Monday after you buy" : ", starting the day you buy"}.
        </p>
      </div>
      {p.description && (
        <section className="mb-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">About the program</h2>
          <p className="text-[15px] leading-relaxed"><LinkedText text={p.description} /></p>
        </section>
      )}
      <p className="text-center text-xs text-muted">
        Questions? Bought it already? <Link href="/signup" className="font-bold underline underline-offset-4">Create your account</Link> ·{" "}
        <Link href="/login" className="font-bold underline underline-offset-4">Sign in</Link>
      </p>
    </Screen>
  );
}
