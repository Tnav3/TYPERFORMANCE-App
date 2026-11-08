import { requireState } from "@/lib/session";
import { CONSENT_CHECKBOX, CONSENT_PARAGRAPHS, CONSENT_TITLE } from "@/lib/consent";
import { Alert, Button, Card, Heading, Screen, SignOutButton } from "@/components/ui";
import { acceptConsent } from "../actions";

export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireState(["needs_consent"]);
  const { error } = await searchParams;

  return (
    <Screen>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Step 1 of 2</p>
      <Heading>{CONSENT_TITLE}</Heading>
      {error === "1" && <Alert>Tick the box to continue.</Alert>}
      {error === "2" && <Alert>Couldn&apos;t save. Please try again.</Alert>}
      <Card className="mb-6 space-y-4 text-[15px] leading-relaxed text-text/90">
        {CONSENT_PARAGRAPHS.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </Card>
      <form action={acceptConsent}>
        <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2 p-4">
          <input type="checkbox" name="agree" required className="mt-0.5 h-6 w-6 shrink-0 accent-brand" />
          <span className="text-[15px]">{CONSENT_CHECKBOX}</span>
        </label>
        <Button type="submit">Agree and continue</Button>
      </form>
      <div className="mt-6 text-center">
        <SignOutButton />
      </div>
    </Screen>
  );
}
