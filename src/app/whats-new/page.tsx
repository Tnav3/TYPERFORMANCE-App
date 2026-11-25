import { requireState } from "@/lib/session";
import { BackLink, Heading, Screen } from "@/components/ui";
import { latestFor } from "@/lib/changelog";
import { formatDate } from "@/lib/dates";
import { APP_VERSION } from "@/lib/app-version";

export const dynamic = "force-dynamic";

export default async function WhatsNew() {
  const { state } = await requireState(["athlete", "coach"]);
  const releases = latestFor(state === "coach" ? "coach" : "client");
  return (
    <Screen>
      <BackLink href={state === "coach" ? "/coach" : "/more"} label="Back" />
      <Heading sub={`You're on version ${APP_VERSION}`}>What&apos;s new</Heading>
      <div className="space-y-4">
        {releases.map((r) => (
          <section key={r.version} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">{formatDate(r.date)} · v{r.version}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {r.items.map((i) => <li key={i.text}>{i.text}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </Screen>
  );
}
