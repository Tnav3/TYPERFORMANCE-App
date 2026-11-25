import { requireState } from "@/lib/session";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";
import { savePlan } from "./actions";

export const dynamic = "force-dynamic";
const input = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const { error, saved } = await searchParams;
  const [{ data: plans }, { data: counts }] = await Promise.all([
    supabase.from("coaching_plans").select("*").order("sort_order"),
    supabase.from("profiles").select("plan_key").eq("role", "athlete").eq("status", "active"),
  ]);
  const n = new Map<string, number>();
  for (const c of counts ?? []) if (c.plan_key) n.set(c.plan_key, (n.get(c.plan_key) ?? 0) + 1);
  return (
    <Screen wide>
      <BackLink href="/coach" label="Dashboard" />
      <Heading sub="Each client is on a plan. Paste your Calendly (or any https) link and clients on that plan get a Book button on their home screen.">Coaching plans &amp; booking</Heading>
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(plans ?? []).map((p) => (
          <form key={p.key} id={p.key} action={savePlan} className={`space-y-2 rounded-2xl border bg-surface p-4 ${saved === p.key ? "border-ok" : "border-line"}`}>
            <input type="hidden" name="key" value={p.key} />
            <div className="flex items-center justify-between gap-2">
              <input name="name" defaultValue={p.name} maxLength={40} className={`${input} font-extrabold`} aria-label="Plan name" />
              <span className="shrink-0 text-xs text-muted">{n.get(p.key) ?? 0} clients</span>
            </div>
            <label className="block text-sm text-muted">
              Catch-up / session frequency
              <select name="cadence" defaultValue={p.cadence ?? ""} className={input}>
                <option value="">None</option>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="per_session">Each session (in person)</option>
              </select>
            </label>
            <label className="block text-sm text-muted">
              Button text
              <input name="booking_label" defaultValue={p.booking_label ?? ""} maxLength={60} className={input} />
            </label>
            <label className="block text-sm text-muted">
              Booking link (Calendly)
              <input name="booking_url" type="url" defaultValue={p.booking_url ?? ""} placeholder="https://calendly.com/…" className={input} />
            </label>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={p.active} className="size-4" /> Offered
              </label>
              <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold text-white">{saved === p.key ? "Saved ✓" : "Save"}</button>
            </div>
          </form>
        ))}
      </div>
    </Screen>
  );
}
