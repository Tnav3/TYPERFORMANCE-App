import { requireState } from "@/lib/session";
import { BackLink, Card, Heading, Screen } from "@/components/ui";
import { ShareLink } from "./ShareLink";

export const dynamic = "force-dynamic";

export default async function ReferPage() {
  const { supabase, user, profile } = await requireState(["athlete"]);
  const [{ data: offer }, { count }] = await Promise.all([
    supabase.from("referral_offers").select("title, body, reward").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", user!.id),
  ]);
  const code = (profile as unknown as { referral_code?: string | null }).referral_code;
  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading sub={offer?.reward ?? undefined}>{offer?.title ?? "Refer a friend"}</Heading>
      {offer?.body && <p className="mb-5 whitespace-pre-line text-muted">{offer.body}</p>}
      <Card className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Your personal link</p>
        {code ? <ShareLink path={`/signup?ref=${code}`} title={offer?.title ?? "Train with TYPERFORMANCE"} /> : <p className="text-muted">Your link isn&apos;t ready yet.</p>}
      </Card>
      <p className="text-center text-sm text-muted">
        {count ? `${count} friend${count === 1 ? " has" : "s have"} joined with your link.` : "Friends who sign up with your link show up here."}
      </p>
    </Screen>
  );
}
