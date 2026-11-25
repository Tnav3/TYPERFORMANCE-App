// Client whose payment failed or was cancelled: chat stays open, everything else waits.
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireState } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { Card, Logo, Screen, SignOutButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OnHoldPage() {
  const { profile } = await requireState(["on_hold"]);
  const chat = hasFeature(profile, "chat");
  const first = profile.full_name?.split(" ")[0];
  return (
    <Screen>
      <div className="mb-8 mt-6">
        <Logo size={72} />
      </div>
      <Card className="text-center">
        <h1 className="mb-2 text-xl font-black uppercase">Training paused</h1>
        <p className="text-muted">
          {first ? `${first}, your` : "Your"} last payment didn&apos;t go through, so your program, logging and extras are paused for now.
          Everything you&apos;ve done is saved. Once your payment is sorted, it all comes back straight away.
        </p>
        <p className="mt-3 text-sm text-muted">Use the payment link in your email or text from TYPERFORMANCE to update your card.</p>
      </Card>
      {chat && (
        <Link href="/chat" className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-black uppercase tracking-wide text-white">
          <MessageCircle size={20} /> Message your coach
        </Link>
      )}
      <div className="mt-6 text-center">
        <SignOutButton />
      </div>
    </Screen>
  );
}
