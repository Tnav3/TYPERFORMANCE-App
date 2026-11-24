import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { requireState } from "@/lib/session";
import { todayISO, formatDate } from "@/lib/dates";
import { KIND_LABEL, REPEAT_LABEL, currentDue, type FormQuestion, type Repeat } from "@/lib/forms";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { addQuestion, assignForm, deleteForm, deleteQuestion, moveQuestion, unassignForm, updateForm, updateQuestion } from "../actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn = "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

function QuestionFields({ q }: { q?: FormQuestion }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
        <input name="label" defaultValue={q?.label ?? ""} required maxLength={200} placeholder="Question" className={input} aria-label="Question" />
        <select name="kind" defaultValue={q?.kind ?? "short"} className={input} aria-label="Answer type">
          {Object.entries(KIND_LABEL).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>
      <input name="help" defaultValue={q?.help ?? ""} maxLength={300} placeholder="Hint under the question (optional)" className={input} aria-label="Hint" />
      <textarea
        name="options"
        defaultValue={(q?.options ?? []).join("\n")}
        rows={3}
        placeholder={"Options for Pick one / Pick any, one per line"}
        className={`${input} py-2`}
        aria-label="Options"
      />
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="required" defaultChecked={q?.required} className="h-5 w-5 accent-[var(--color-brand)]" />
        Must be answered
      </label>
    </div>
  );
}

export default async function FormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const { error } = await searchParams;
  const today = todayISO();
  const [{ data: form }, { data: questions }, { data: assigned }, { data: clients }, { data: responses }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", id).maybeSingle(),
    supabase.from("form_questions").select("*").eq("form_id", id).order("position"),
    supabase.from("form_assignments").select("id, athlete_id, repeat, starts_on, active, profiles(full_name, email)").eq("form_id", id),
    supabase.from("profiles").select("id, full_name, email").eq("role", "athlete").eq("status", "active").order("full_name"),
    supabase.from("form_responses").select("id, athlete_id, due_on, submitted_at, coach_seen_at").eq("form_id", id).order("submitted_at", { ascending: false }).limit(200),
  ]);
  if (!form) notFound();
  const qs = (questions ?? []) as FormQuestion[];
  const back = `/coach/forms/${id}`;
  const already = new Set((assigned ?? []).map((a) => a.athlete_id));

  return (
    <Screen wide>
      <BackLink href="/coach/forms" label="Forms" />
      <Heading sub={form.description ?? undefined}>{form.name}</Heading>
      {error && <Alert>{error}</Alert>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Questions · {qs.length}</h2>
          <div className="space-y-2">
            {qs.map((q, k) => (
              <details key={q.id} id={`q-${q.id}`} className="scroll-mt-6 rounded-2xl border border-line bg-surface p-3">
                <summary className="flex cursor-pointer list-none items-start gap-3">
                  <span className="w-6 shrink-0 font-black text-brand">{k + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">
                      {q.label}
                      {q.required && <span className="text-brand"> *</span>}
                    </span>
                    <span className="block text-xs text-muted">
                      {KIND_LABEL[q.kind]}
                      {q.options.length ? ` · ${q.options.join(" / ")}` : ""}
                    </span>
                  </span>
                  <span className="text-xs text-muted">Edit</span>
                </summary>
                <form action={updateQuestion} className="mt-3">
                  <input type="hidden" name="form_id" value={id} />
                  <input type="hidden" name="id" value={q.id} />
                  <QuestionFields q={q} />
                  <button className={`${smallBtn} mt-2`}>Save</button>
                </form>
                <div className="mt-2 flex gap-2">
                  {(["up", "down"] as const).map((dir) => (
                    <form key={dir} action={moveQuestion}>
                      <input type="hidden" name="form_id" value={id} />
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="dir" value={dir} />
                      <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-muted" aria-label={`Move ${dir}`}>
                        {dir === "up" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </form>
                  ))}
                  <form action={deleteQuestion} className="ml-auto">
                    <input type="hidden" name="form_id" value={id} />
                    <input type="hidden" name="id" value={q.id} />
                    <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-brand" aria-label="Delete question">
                      <Trash2 size={18} />
                    </button>
                  </form>
                </div>
              </details>
            ))}
          </div>
          <Card className="mt-4 !p-4">
            <h3 className="mb-3 font-extrabold">Add a question</h3>
            <form action={addQuestion}>
              <input type="hidden" name="form_id" value={id} />
              <QuestionFields />
              <button className="mt-2 min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Add</button>
            </form>
          </Card>

          <details className="mt-6 rounded-2xl border border-line bg-surface p-4">
            <summary className="cursor-pointer font-bold">Form details</summary>
            <form action={updateForm} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={id} />
              <input name="name" defaultValue={form.name} required maxLength={80} className={input} aria-label="Name" />
              <textarea name="description" defaultValue={form.description ?? ""} rows={2} maxLength={1000} placeholder="Shown to the client at the top" className={`${input} py-2`} aria-label="Description" />
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" name="archived" defaultChecked={form.archived} className="h-5 w-5 accent-[var(--color-brand)]" />
                Archived (hidden from clients)
              </label>
              <button className={smallBtn}>Save</button>
            </form>
            <form action={deleteForm} className="mt-4 flex gap-2">
              <input type="hidden" name="id" value={id} />
              <input name="confirm" placeholder="Type DELETE" className={input} aria-label="Type DELETE to confirm" />
              <button className={`${smallBtn} !text-brand`}>Delete form</button>
            </form>
          </details>
        </div>

        <div className="space-y-4">
          <Card className="!p-4">
            <h3 className="mb-3 font-extrabold">Send to clients</h3>
            <form action={assignForm} className="space-y-2">
              <input type="hidden" name="form_id" value={id} />
              <input type="hidden" name="back" value={back} />
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                {(clients ?? []).length === 0 && <p className="text-sm text-muted">No active clients yet.</p>}
                {(clients ?? []).map((c) => (
                  <label key={c.id} className="flex min-h-10 items-center gap-3 text-sm">
                    <input type="checkbox" name="athlete_id" value={c.id} className="h-5 w-5 accent-[var(--color-brand)]" />
                    {c.full_name ?? c.email}
                    {already.has(c.id) && <span className="text-xs text-muted">(already)</span>}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select name="repeat" defaultValue="weekly" className={input} aria-label="How often">
                  {Object.entries(REPEAT_LABEL).map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
                <input name="starts_on" type="date" defaultValue={today} required className={input} aria-label="First due" />
              </div>
              <p className="text-xs text-muted">The first one is due on the start date, then repeats from there. It shows on their home screen when due.</p>
              <button className="min-h-11 w-full rounded-xl bg-brand text-sm font-extrabold uppercase text-white">Send</button>
            </form>
          </Card>

          <Card className="!p-4">
            <h3 className="mb-2 font-extrabold">Who has it</h3>
            {(assigned ?? []).length === 0 && <p className="text-sm text-muted">Not sent to anyone yet.</p>}
            <ul className="divide-y divide-line text-sm">
              {(assigned ?? []).map((a) => {
                const p = a.profiles as unknown as { full_name: string | null; email: string } | null;
                const due = currentDue({ repeat: a.repeat as Repeat, starts_on: a.starts_on }, today);
                const got = (responses ?? []).some((r) => r.athlete_id === a.athlete_id && r.due_on === due);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/coach/athlete/${a.athlete_id}/forms`} className="min-w-0">
                      <span className="block truncate font-bold">{p?.full_name ?? p?.email ?? "Client"}</span>
                      <span className="block text-xs text-muted">
                        {REPEAT_LABEL[a.repeat as Repeat]} · {due ? (got ? <span className="text-ok">done for {formatDate(due)}</span> : <span className="text-warn">due {formatDate(due)}</span>) : `starts ${formatDate(a.starts_on)}`}
                      </span>
                    </Link>
                    <form action={unassignForm}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="back" value={back} />
                      <button className="text-xs text-muted underline underline-offset-4">Stop</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </Screen>
  );
}
