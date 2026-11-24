import { requireState } from "@/lib/session";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { bulkInvite, removeInvite } from "./actions";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; added?: string; skipped?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const sp = await searchParams;
  const [{ data: invites }, { data: events }] = await Promise.all([
    supabase.from("invites").select("*").order("created_at", { ascending: false }),
    supabase.from("payment_events").select("received_at, event, email, plan, result").order("received_at", { ascending: false }).limit(30),
  ]);
  const pending = (invites ?? []).filter((i) => !i.used_at);
  const used = (invites ?? []).filter((i) => i.used_at);

  return (
    <Screen wide>
      <BackLink href="/coach" label="Dashboard" />
      <Heading sub="Invited emails skip your approval queue when they sign up. GHL payments add invites automatically.">Invites &amp; payments</Heading>
      {sp.error && <Alert>{sp.error}</Alert>}
      {sp.added && (
        <Alert tone="ok">
          Added {sp.added} invite{sp.added === "1" ? "" : "s"}
          {sp.skipped && sp.skipped !== "0" ? ` · ${sp.skipped} already have an account` : ""}.
        </Alert>
      )}
      <Card className="mb-6 !p-4">
        <h2 className="mb-2 font-extrabold">Bulk invite (e.g. your Trainerize clients)</h2>
        <form action={bulkInvite} className="space-y-2">
          <textarea
            name="emails"
            rows={5}
            placeholder={"Paste emails: one per line, or separated by commas"}
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-text focus:border-brand focus:outline-none"
            aria-label="Emails"
          />
          <div className="flex gap-2">
            <select name="plan" defaultValue="basic" className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-text" aria-label="Plan">
              <option value="basic">Basic</option>
              <option value="premium">Premium (meal plan builder on)</option>
            </select>
            <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Add invites</button>
          </div>
          <p className="text-xs text-muted">Then send them the app link (e.g. from GHL). They sign up with the same email and go straight in after consent and profile.</p>
        </form>
      </Card>

      <Card className="mb-6 !p-4">
        <h2 className="mb-2 font-extrabold">Waiting to sign up · {pending.length}</h2>
        <ul className="space-y-1 text-sm">
          {pending.map((i) => (
            <li key={i.email} className="flex items-center justify-between gap-2">
              <span>
                {i.email} <span className="text-muted">· {i.plan ?? "basic"}{i.note ? ` · ${i.note}` : ""}</span>
              </span>
              <form action={removeInvite}>
                <input type="hidden" name="email" value={i.email} />
                <button className="text-xs text-muted underline underline-offset-4">Remove</button>
              </form>
            </li>
          ))}
          {!pending.length && <li className="text-muted">None.</li>}
        </ul>
        {used.length > 0 && <p className="mt-2 text-xs text-muted">{used.length} invite{used.length === 1 ? "" : "s"} already used.</p>}
      </Card>

      <Card className="!p-4">
        <h2 className="mb-2 font-extrabold">Recent payment events from GHL</h2>
        <ul className="space-y-1 text-sm">
          {(events ?? []).map((e, i) => (
            <li key={i}>
              <span className="text-muted">{when.format(new Date(e.received_at))}</span> · {e.event} · {e.email ?? "no email"}
              {e.plan && <span className="text-muted"> · {e.plan}</span>} → <span className="font-bold">{e.result}</span>
            </li>
          ))}
          {!(events ?? []).length && <li className="text-muted">Nothing received yet. See docs/LAUNCH.md for the GHL setup.</li>}
        </ul>
      </Card>
    </Screen>
  );
}
