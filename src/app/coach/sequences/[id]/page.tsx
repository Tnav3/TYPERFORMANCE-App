import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { deleteSequence, deleteStep, enrol, saveStep, stopEnrolment, toggleStep, updateSequence } from "../actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const input = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn = "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

type Opt = { id: string; name: string };
function StepFields({ s, forms, files }: { s?: { day_offset: number; send_time: string; body: string; form_id?: string | null; file_id?: string | null }; forms: Opt[]; files: Opt[] }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        Day
        <input name="day_offset" type="number" min={0} max={365} defaultValue={s?.day_offset ?? 0} className={`${input} !w-20`} aria-label="Day" />
        at
        <input name="send_time" type="time" defaultValue={s?.send_time.slice(0, 5) ?? "09:00"} className={`${input} !w-32`} aria-label="Time" />
        <span className="text-xs text-muted">(day 0 at 00:00 = straight away)</span>
      </div>
      <textarea name="body" rows={4} maxLength={2000} defaultValue={s?.body} placeholder="Hey {first_name}, …" className={`${input} mt-2 py-2`} aria-label="Message" />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select name="file_id" defaultValue={s?.file_id ?? ""} className={input} aria-label="Attach a file">
          <option value="">No file attached</option>
          {files.map((f) => <option key={f.id} value={f.id}>📎 {f.name}</option>)}
        </select>
        <select name="form_id" defaultValue={s?.form_id ?? ""} className={input} aria-label="Send a form">
          <option value="">No form</option>
          {forms.map((f) => <option key={f.id} value={f.id}>📝 {f.name}</option>)}
        </select>
      </div>
    </>
  );
}

export default async function SequencePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const { error } = await searchParams;
  const [{ data: seq }, { data: steps }, { data: enrolled }, { data: clients }, { data: sends }, { data: formRows }, { data: fileRows }] = await Promise.all([
    supabase.from("sequences").select("*").eq("id", id).maybeSingle(),
    supabase.from("sequence_steps").select("*").eq("sequence_id", id).order("day_offset").order("send_time"),
    supabase.from("sequence_enrollments").select("athlete_id, started_on, stopped_at, profiles(full_name, email)").eq("sequence_id", id).order("started_on", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").eq("role", "athlete").eq("status", "active").order("full_name"),
    supabase.from("sequence_sends").select("athlete_id, step_id"),
    supabase.from("forms").select("id, name").eq("archived", false).order("name"),
    supabase.from("coach_files").select("id, name").order("name"),
  ]);
  const forms = (formRows ?? []) as Opt[];
  const files = (fileRows ?? []) as Opt[];
  if (!seq) notFound();
  const stepIds = new Set((steps ?? []).map((s) => s.id));
  const sentBy = new Map<string, number>();
  for (const s of sends ?? []) if (stepIds.has(s.step_id)) sentBy.set(s.athlete_id, (sentBy.get(s.athlete_id) ?? 0) + 1);
  const enrolledRows = (enrolled ?? []) as unknown as { athlete_id: string; started_on: string; stopped_at: string | null; profiles: { full_name: string | null; email: string } }[];

  return (
    <Screen wide>
      <BackLink href="/coach/sequences" label="Sequences" />
      <Heading sub={`${seq.trigger === "approved" ? "Starts automatically when you approve a client" : "Starts when you add a client"}${seq.active ? "" : " · paused"}. {first_name} is replaced with their first name.`}>
        {seq.name}
      </Heading>
      {error && <Alert>{error}</Alert>}
      <p className="mb-3 text-sm text-muted">
        Files (PARQ, waiver, start-up guide) live in your <Link href="/coach/files" className="font-bold text-text underline underline-offset-4">file library</Link>. Clients open them in one tap from the message.
      </p>

      <div className="mb-6 space-y-2">
        {(steps ?? []).map((s) => (
          <Card key={s.id} className={`!p-3 ${s.active ? "" : "opacity-60"}`}>
            <form action={toggleStep} className="mb-2 flex justify-end">
              <input type="hidden" name="sequence_id" value={id} />
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="on" value={String(!s.active)} />
              <button className={`min-h-9 rounded-full px-3 text-xs font-extrabold ${s.active ? "bg-ok text-ink" : "border border-line text-muted"}`} aria-label={s.active ? "Switch this message off" : "Switch this message on"}>
                {s.active ? "On" : "Off"}
              </button>
            </form>
            <form action={saveStep}>
              <input type="hidden" name="sequence_id" value={id} />
              <input type="hidden" name="id" value={s.id} />
              <StepFields s={s} forms={forms} files={files} />
              <div className="mt-2 flex gap-2">
                <button className={smallBtn}>Save</button>
              </div>
            </form>
            <form action={deleteStep} className="mt-1">
              <input type="hidden" name="sequence_id" value={id} />
              <input type="hidden" name="id" value={s.id} />
              <button className="text-xs text-brand underline underline-offset-4">Delete message</button>
            </form>
          </Card>
        ))}
        <Card className="border-brand/50 !p-3">
          <p className="mb-2 font-bold">Add a message</p>
          <form action={saveStep}>
            <input type="hidden" name="sequence_id" value={id} />
            <StepFields forms={forms} files={files} />
            <button className={`${smallBtn} mt-2`}>Add</button>
          </form>
        </Card>
      </div>

      <Card className="mb-6 !p-4">
        <h2 className="mb-2 font-extrabold">Clients in this sequence</h2>
        <ul className="space-y-1 text-sm">
          {enrolledRows.map((e) => (
            <li key={e.athlete_id} className="flex items-center justify-between gap-2">
              <span className={e.stopped_at ? "text-muted line-through" : ""}>
                {e.profiles.full_name ?? e.profiles.email}{" "}
                <span className="text-muted">
                  · from {formatDate(e.started_on)} · {sentBy.get(e.athlete_id) ?? 0}/{(steps ?? []).length} sent
                </span>
              </span>
              {!e.stopped_at && (
                <form action={stopEnrolment}>
                  <input type="hidden" name="sequence_id" value={id} />
                  <input type="hidden" name="athlete_id" value={e.athlete_id} />
                  <button className="text-xs text-muted underline underline-offset-4">Stop</button>
                </form>
              )}
            </li>
          ))}
          {!enrolledRows.length && <li className="text-muted">Nobody yet.</li>}
        </ul>
        <form action={enrol} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="sequence_id" value={id} />
          <select name="athlete_id" required defaultValue="" className={`${input} !w-auto flex-1`} aria-label="Client">
            <option value="" disabled>Add a client…</option>
            {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name ?? c.email}</option>)}
          </select>
          <input type="date" name="start" defaultValue={todayISO()} className={`${input} !w-40`} aria-label="Start" />
          <button className={smallBtn}>Add</button>
        </form>
      </Card>

      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-bold">Sequence settings</summary>
        <form action={updateSequence} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="id" value={id} />
          <input name="name" defaultValue={seq.name} maxLength={80} className={`${input} flex-1`} aria-label="Name" />
          <select name="trigger" defaultValue={seq.trigger} className={`${input} !w-auto`} aria-label="Starts">
            <option value="approved">Auto on approval</option>
            <option value="manual">Manual only</option>
          </select>
          <button className={smallBtn}>Save</button>
        </form>
        <div className="mt-3 flex gap-4 text-sm">
          <form action={updateSequence}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="active" value={String(!seq.active)} />
            <button className="text-muted underline underline-offset-4">{seq.active ? "Pause sequence" : "Resume sequence"}</button>
          </form>
          <form action={deleteSequence}>
            <input type="hidden" name="id" value={id} />
            <button className="text-brand underline underline-offset-4">Delete sequence</button>
          </form>
        </div>
      </details>
    </Screen>
  );
}
