import { requireState } from "@/lib/session";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";
import { FeedbackForm } from "@/components/FeedbackForm";
import { safeNext } from "@/lib/safe-next";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; from?: string }> }) {
  const { state } = await requireState(["athlete", "coach"]);
  const sp = await searchParams;
  const from = safeNext(sp.from ?? "", state === "coach" ? "/coach" : "/more");
  return (
    <Screen>
      <BackLink href={from} label="Back" />
      <Heading sub="Spotted a bug, or have an idea? It goes straight to Tyrell.">Report a problem or idea</Heading>
      {sp.sent ? (
        <Alert tone="ok">Thanks, got it. I&apos;ll look at it and let you know when it&apos;s sorted.</Alert>
      ) : (
        <>
          {sp.error && <Alert>That didn&apos;t send. Please try again.</Alert>}
          <FeedbackForm from={from} />
        </>
      )}
    </Screen>
  );
}
