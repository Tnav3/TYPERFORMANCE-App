import Link from "next/link";
import { requireState } from "@/lib/session";
import { Alert, Card, Heading, Screen } from "@/components/ui";
import { summary, TEMPLATES, TRIGGERS, type Audience, type Trigger } from "@/lib/automations";
import { formatDate } from "@/lib/dates";
import { addFromTemplate, deleteAutomation, runNow, saveAutomation, toggleAutomation } from "./actions";

export const dynamic = "force-dynamic";

const input = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

type Rule = { id: string; name: string; trigger: Trigger; threshold: number; audience: Audience; body: string; cooldown_days: number; active: boolean };

function RuleForm({ r }: { r?: Rule }) {
  return (
    <form action={saveAutomation} className="space-y-3">
      {r && <input type="hidden" name="id" value={r.id} />}
      <input name="name" required maxLength={80} defaultValue={r?.name} placeholder="Name, e.g. Missed 2 sessions" className={input} aria-label="Name" />
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
        <select name="trigger" defaultValue={r?.trigger ?? "missed_sessions"} className={input} aria-label="When">
          {(Object.keys(TRIGGERS) as Trigger[]).map((t) => (
            <option key={t} value={t}>{TRIGGERS[t].label} ({TRIGGERS[t].unit})</option>
          ))}
        </select>
        <input name="threshold" type="number" inputMode="numeric" min={1} max={100} defaultValue={r?.threshold ?? 2} className={input} aria-label="Number" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["client", "coach"] as const).map((a) => (
          <label key={a} className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold has-[:checked]:border-brand">
            <input type="radio" name="audience" value={a} defaultChecked={(r?.audience ?? "client") === a} className="accent-[var(--color-brand,#e10600)]" />
            {a === "client" ? "Message the client" : "Just tell me"}
          </label>
        ))}
      </div>
      <textarea name="body" rows={3} maxLength={1000} defaultValue={r?.body} placeholder="Hey {first_name}, …  (for 'Just tell me' this is your note)" className={`${input} py-2`} aria-label="Message" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          Don&apos;t repeat for the same client within
          <input name="cooldown_days" type="number" min={1} max={90} defaultValue={r?.cooldown_days ?? 7} className="min-h-10 w-16 rounded-lg border border-line bg-surface-2 px-2 text-text" aria-label="Days" /> days
        </label>
        <button className="min-h-11 rounded-xl bg-brand px-5 font-extrabold text-white">{r ? "Save" : "Add rule"}</button>
      </div>
    </form>
  );
}

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<{ error?: string; ran?: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const { error, ran } = await searchParams;
  const [{ data: rules }, { data: runs }] = await Promise.all([
    supabase.from("automations").select("id, name, trigger, threshold, audience, body, cooldown_days, active").order("created_at"),
    supabase.from("automation_runs").select("id, ran_on, detail, athlete_id, automations(name), profiles(full_name)").order("created_at", { ascending: false }).limit(15),
  ]);
  const list = (rules ?? []) as Rule[];
  const previews = await Promise.all(
    list.map(async (r) => ((await supabase.rpc("automation_preview", { p_id: r.id })).data ?? []) as { athlete_id: string; full_name: string | null; detail: string }[]),
  );
  const log = (runs ?? []) as unknown as { id: string; ran_on: string; detail: string | null; athlete_id: string; automations: { name: string } | null; profiles: { full_name: string | null } | null }[];
  const unused = TEMPLATES.map((t, i) => ({ t, i })).filter(({ t }) => !list.some((r) => r.name === t.name));

  return (
    <Screen wide>
      <Heading sub="Rules that watch your clients and act for you. They check every morning from 9am. New rules start switched off so you can see who they'd hit first.">
        Automations
      </Heading>
      {error && <Alert>{error}</Alert>}
      {ran != null && <Alert tone={Number(ran) < 0 ? "error" : "ok"}>{Number(ran) < 0 ? "That didn't run. Please try again." : `Done: ${ran} action${ran === "1" ? "" : "s"} taken.`}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {list.length === 0 && <p className="rounded-xl border border-line bg-surface p-4 text-muted">No rules yet. Start from one of the ready-made ones.</p>}
          {list.map((r, i) => (
            <Card key={r.id} className="!p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold">{r.name}</p>
                  <p className="text-sm text-muted">{summary(r.trigger, r.threshold, r.audience)}</p>
                </div>
                <form action={toggleAutomation}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="on" value={String(!r.active)} />
                  <button
                    aria-label={r.active ? "Switch off" : "Switch on"}
                    className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-extrabold ${r.active ? "bg-ok text-ink" : "border border-line text-muted"}`}
                  >
                    {r.active ? "On" : "Off"}
                  </button>
                </form>
              </div>
              <p className="mt-2 text-sm">
                <span className="font-bold">{previews[i].length}</span>
                <span className="text-muted"> client{previews[i].length === 1 ? "" : "s"} match right now</span>
                {previews[i].length > 0 && (
                  <span className="text-muted">
                    : {previews[i].slice(0, 4).map((p) => p.full_name ?? "Client").join(", ")}
                    {previews[i].length > 4 ? ` +${previews[i].length - 4}` : ""}
                  </span>
                )}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-bold text-muted">Edit</summary>
                <div className="mt-3">
                  <RuleForm r={r} />
                  <form action={deleteAutomation} className="mt-2 text-right">
                    <input type="hidden" name="id" value={r.id} />
                    <button className="min-h-10 text-sm font-bold text-brand">Delete rule</button>
                  </form>
                </div>
              </details>
            </Card>
          ))}

          <details className="rounded-xl border border-line bg-surface p-4" open={list.length === 0}>
            <summary className="cursor-pointer font-extrabold">+ Build your own rule</summary>
            <div className="mt-3">
              <RuleForm />
            </div>
            <p className="mt-2 text-xs text-muted">{"{first_name}"} is swapped for the client&apos;s first name.</p>
          </details>
        </div>

        <aside className="space-y-4">
          {unused.length > 0 && (
            <Card className="!p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Ready-made</h2>
              <ul className="space-y-2">
                {unused.map(({ t, i }) => (
                  <li key={t.name}>
                    <form action={addFromTemplate} className="flex items-center justify-between gap-2">
                      <input type="hidden" name="i" value={i} />
                      <span className="min-w-0 text-sm">
                        <span className="font-bold">{t.name}</span>
                        <span className="block text-xs text-muted">{t.audience === "client" ? "Messages the client" : "Tells you"}</span>
                      </span>
                      <button className="min-h-10 shrink-0 rounded-lg border border-line px-3 text-sm font-bold">Add</button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="!p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Recent</h2>
              {list.some((r) => r.active) && (
                <form action={runNow}>
                  <button className="min-h-9 rounded-lg border border-line px-3 text-xs font-bold">Run now</button>
                </form>
              )}
            </div>
            {log.length === 0 ? (
              <p className="text-sm text-muted">Nothing sent yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {log.map((x) => (
                  <li key={x.id}>
                    <Link href={`/coach/athlete/${x.athlete_id}`} className="font-bold hover:text-brand">{x.profiles?.full_name ?? "Client"}</Link>
                    <span className="text-muted"> · {x.automations?.name} · {formatDate(x.ran_on)}</span>
                    {x.detail && <span className="block text-xs text-muted">{x.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </Screen>
  );
}
