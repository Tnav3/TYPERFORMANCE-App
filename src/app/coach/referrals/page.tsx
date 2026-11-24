import { requireState } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { Alert, Card, Heading, Screen } from "@/components/ui";
import { markRewarded, saveOffer } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const { error } = await searchParams;
  const [{ data: offers }, { data: refs }] = await Promise.all([
    supabase.from("referral_offers").select("*").order("created_at", { ascending: false }),
    supabase
      .from("referrals")
      .select("id, created_at, rewarded_at, referrer:profiles!referrals_referrer_id_fkey(full_name, email), referred:profiles!referrals_referred_id_fkey(full_name, email, status)")
      .order("created_at", { ascending: false }),
  ]);
  const current = offers?.[0];
  type P = { full_name: string | null; email: string; status?: string } | null;

  return (
    <Screen wide>
      <Heading sub="Clients get a personal sign-up link on their home screen. You see who brought who.">Referrals</Heading>
      {error && <Alert>{error}</Alert>}
      <div className="grid items-start gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="!p-4">
          <h2 className="mb-3 font-extrabold">{current ? "Your offer" : "Create an offer"}</h2>
          <form action={saveOffer} className="space-y-2">
            {current && <input type="hidden" name="id" value={current.id} />}
            <input name="title" defaultValue={current?.title ?? "Bring a training partner"} required maxLength={80} className={input} aria-label="Title" />
            <input name="reward" defaultValue={current?.reward ?? ""} maxLength={200} placeholder="Reward, e.g. 2 weeks free for you both" className={input} aria-label="Reward" />
            <textarea name="body" defaultValue={current?.body ?? ""} rows={4} maxLength={1000} placeholder="Details clients see" className={`${input} py-2`} aria-label="Details" />
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="active" defaultChecked={current ? current.active : true} className="h-5 w-5 accent-[var(--color-brand)]" />
              Show it to clients
            </label>
            <button className="min-h-11 w-full rounded-xl bg-brand text-sm font-extrabold uppercase text-white">Save</button>
          </form>
        </Card>
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Sign-ups from referrals · {(refs ?? []).length}</h2>
          {(refs ?? []).length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">None yet.</p>
          ) : (
            <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {(refs ?? []).map((r) => {
                const by = r.referrer as unknown as P;
                const who = r.referred as unknown as P;
                return (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span>
                      <b>{who?.full_name ?? who?.email}</b> <span className="text-muted">joined via</span> <b>{by?.full_name ?? by?.email}</b>
                      <span className="block text-xs text-muted">
                        {formatDate(r.created_at.slice(0, 10))} · {who?.status === "active" ? "approved" : who?.status ?? ""}
                      </span>
                    </span>
                    <form action={markRewarded}>
                      <input type="hidden" name="id" value={r.id} />
                      {r.rewarded_at && <input type="hidden" name="undo" value="1" />}
                      <button className={`min-h-10 rounded-xl border px-3 text-sm font-bold ${r.rewarded_at ? "border-ok text-ok" : "border-line"}`}>
                        {r.rewarded_at ? "Rewarded ✓" : "Mark rewarded"}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
