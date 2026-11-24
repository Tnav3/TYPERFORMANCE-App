import Link from "next/link";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { scheduleLabel } from "@/lib/programming/schedule";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { createScheduled, deleteScheduled, sendNow, setScheduledActive } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";
const when = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function Targets({ groups, clients }: { groups: { id: string; name: string }[]; clients: { id: string; full_name: string | null; email: string }[] }) {
  return (
    <select name="target" defaultValue="all" className={input} aria-label="Send to">
      <option value="all">All clients (with chat on)</option>
      {groups.length > 0 && (
        <optgroup label="Groups">
          {groups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}
        </optgroup>
      )}
      <optgroup label="One client">
        {clients.map((c) => <option key={c.id} value={`a:${c.id}`}>{c.full_name ?? c.email}</option>)}
      </optgroup>
    </select>
  );
}

export default async function ScheduledMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const sp = await searchParams;
  const [{ data: rows }, { data: groups }, { data: clients }] = await Promise.all([
    supabase
      .from("scheduled_messages")
      .select("*, profiles!scheduled_messages_athlete_id_fkey(full_name, email), groups(name)")
      .order("active", { ascending: false })
      .order("next_send_at", { ascending: true }),
    supabase.from("groups").select("id, name").eq("archived", false).order("name"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "athlete").eq("status", "active").order("full_name"),
  ]);
  const list = (rows ?? []) as {
    id: string;
    body: string;
    target: string;
    repeat: string;
    weekdays: number[] | null;
    every_days: number | null;
    time_of_day: string;
    next_send_at: string | null;
    active: boolean;
    sent_count: number;
    profiles: { full_name: string | null; email: string } | null;
    groups: { name: string } | null;
  }[];

  return (
    <Screen wide>
      <BackLink href="/coach/chat" label="Inbox" />
      <Heading sub="Delivered inside the app's chat (not email). Recurring messages go out within a minute of the set time, Sydney time.">
        Scheduled messages
      </Heading>
      <Link href="/coach/sequences" className="mb-4 flex min-h-12 items-center justify-between rounded-xl border border-line bg-surface-2 px-4 font-extrabold">
        Onboarding sequences <span aria-hidden>→</span>
      </Link>
      {sp.error && <Alert>{sp.error}</Alert>}
      {sp.saved && <Alert tone="ok">Saved.</Alert>}

      <Card className="mb-6 !p-4">
        <h2 className="mb-3 font-extrabold">New message</h2>
        <form action={createScheduled} className="space-y-3">
          <textarea name="body" required rows={3} maxLength={2000} placeholder="e.g. Sunday check-in: how did training feel this week? Weigh in tomorrow morning." className={`${input} py-2`} aria-label="Message" />
          <Targets groups={groups ?? []} clients={clients ?? []} />
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm text-muted">When</legend>
            <label className="flex min-h-11 items-center gap-3">
              <input type="radio" name="repeat" value="none" defaultChecked className="h-5 w-5 accent-[var(--color-brand)]" />
              Once on
              <input type="date" name="date" defaultValue={todayISO()} className={`${input} !w-auto`} aria-label="Date" />
            </label>
            <div className="flex min-h-11 flex-wrap items-center gap-3">
              <label className="flex items-center gap-3">
                <input type="radio" name="repeat" value="weekly" className="h-5 w-5 accent-[var(--color-brand)]" />
                Every week on
              </label>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <label key={i} className="cursor-pointer">
                  <input type="checkbox" name="weekdays" value={i + 1} className="peer sr-only" />
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-sm peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white">
                    {d}
                  </span>
                </label>
              ))}
            </div>
            <label className="flex min-h-11 items-center gap-3">
              <input type="radio" name="repeat" value="days" className="h-5 w-5 accent-[var(--color-brand)]" />
              Every
              <input type="number" name="every_days" min={1} max={90} defaultValue={7} className={`${input} !w-20`} aria-label="Days" />
              days
            </label>
            <label className="flex items-center gap-3 text-sm">
              At
              <input type="time" name="time" defaultValue="09:00" required className={`${input} !w-36`} aria-label="Time" />
            </label>
          </fieldset>
          <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Schedule</button>
        </form>
      </Card>

      <details className="mb-6 rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-extrabold">Send an announcement now</summary>
        <form action={sendNow} className="mt-3 space-y-3">
          <textarea name="body" required rows={3} maxLength={2000} className={`${input} py-2`} aria-label="Message" />
          <Targets groups={groups ?? []} clients={clients ?? []} />
          <button className={smallBtn}>Send now</button>
        </form>
      </details>

      <div className="space-y-2">
        {list.map((s) => (
          <Card key={s.id} className={`!p-3 ${s.active ? "" : "opacity-60"}`}>
            <p className="whitespace-pre-line">{s.body}</p>
            <p className="mt-1 text-xs text-muted">
              To {s.target === "all" ? "all clients" : s.target === "group" ? s.groups?.name : s.profiles?.full_name ?? s.profiles?.email} ·{" "}
              {scheduleLabel(s)} ·{" "}
              {s.active && s.next_send_at ? `next ${when.format(new Date(s.next_send_at))}` : s.sent_count ? `sent ${s.sent_count}×` : "paused"}
            </p>
            <div className="mt-2 flex gap-3 text-sm">
              {(s.repeat !== "none" || !s.sent_count) && (
                <form action={setScheduledActive}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="active" value={String(!s.active)} />
                  <button className="text-muted underline underline-offset-4">{s.active ? "Pause" : "Resume"}</button>
                </form>
              )}
              <form action={deleteScheduled}>
                <input type="hidden" name="id" value={s.id} />
                <button className="text-brand underline underline-offset-4">Delete</button>
              </form>
            </div>
          </Card>
        ))}
        {list.length === 0 && <p className="text-muted">Nothing scheduled.</p>}
      </div>
    </Screen>
  );
}
