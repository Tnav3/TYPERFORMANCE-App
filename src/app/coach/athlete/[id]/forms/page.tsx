import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { currentDue, isOverdue, REPEAT_LABEL, showAnswer, type FormQuestion, type Repeat } from "@/lib/forms";
import { ClientTabs } from "@/components/ClientTabs";
import { Screen } from "@/components/ui";
import { markResponseSeen } from "@/app/coach/forms/actions";

export const dynamic = "force-dynamic";

export default async function ClientForms({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const today = todayISO();
  const [{ data: p }, { data: asg }, { data: resp }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle(),
    supabase.from("form_assignments").select("id, form_id, repeat, starts_on, active, forms(name)").eq("athlete_id", id),
    supabase.from("form_responses").select("id, form_id, due_on, submitted_at, coach_seen_at, answers").eq("athlete_id", id).order("submitted_at", { ascending: false }).limit(30),
  ]);
  if (!p) notFound();
  const formIds = [...new Set([...(asg ?? []).map((a) => a.form_id), ...(resp ?? []).map((r) => r.form_id)])];
  const { data: qs } = formIds.length
    ? await supabase.from("form_questions").select("*").in("form_id", formIds).order("position")
    : { data: [] };
  const byForm = new Map<string, FormQuestion[]>();
  for (const q of (qs ?? []) as (FormQuestion & { form_id: string })[]) byForm.set(q.form_id, [...(byForm.get(q.form_id) ?? []), q]);
  const formName = new Map((asg ?? []).map((a) => [a.form_id, (a.forms as unknown as { name: string } | null)?.name ?? "Form"]));
  const back = `/coach/athlete/${id}/forms`;

  return (
    <Screen wide>
      <ClientTabs id={id} name={p.full_name ?? p.email} active="forms" />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {(resp ?? []).length === 0 && <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">No check-ins submitted yet.</p>}
          {(resp ?? []).map((r) => (
            <details key={r.id} open={!r.coach_seen_at} className={`rounded-2xl border bg-surface p-4 ${r.coach_seen_at ? "border-line" : "border-brand"}`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <span>
                  <span className="block font-extrabold">{formName.get(r.form_id) ?? "Form"}</span>
                  <span className="block text-xs text-muted">For {formatDate(r.due_on)} · sent {formatDate(r.submitted_at.slice(0, 10))}</span>
                </span>
                {!r.coach_seen_at && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-black text-white">New</span>}
              </summary>
              <dl className="mt-3 space-y-2 text-sm">
                {(byForm.get(r.form_id) ?? []).map((q) => (
                  <div key={q.id}>
                    <dt className="text-muted">{q.label}</dt>
                    <dd className="whitespace-pre-line font-semibold">{showAnswer((r.answers as Record<string, unknown>)[q.id])}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex gap-2">
                {!r.coach_seen_at && (
                  <form action={markResponseSeen}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="back" value={back} />
                    <button className="min-h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold">Mark as read</button>
                  </form>
                )}
                <Link href={`/coach/chat/${id}`} className="flex min-h-10 items-center rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold">
                  Reply in chat
                </Link>
              </div>
            </details>
          ))}
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-2 font-extrabold">Forms they get</h2>
          {(asg ?? []).length === 0 && <p className="text-sm text-muted">None yet.</p>}
          <ul className="space-y-2 text-sm">
            {(asg ?? []).map((a) => {
              const due = currentDue({ repeat: a.repeat as Repeat, starts_on: a.starts_on }, today);
              const got = (resp ?? []).some((r) => r.form_id === a.form_id && r.due_on === due);
              return (
                <li key={a.id}>
                  <Link href={`/coach/forms/${a.form_id}`} className="font-bold underline underline-offset-4">{formName.get(a.form_id)}</Link>
                  <span className="block text-xs text-muted">
                    {REPEAT_LABEL[a.repeat as Repeat]}
                    {!a.active ? " · stopped" : due ? (got ? " · up to date" : isOverdue(due, false, today) ? ` · overdue since ${formatDate(due)}` : ` · due ${formatDate(due)}`) : ` · starts ${formatDate(a.starts_on)}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link href="/coach/forms" className="mt-3 inline-block text-sm font-bold text-brand">Send a form →</Link>
        </div>
      </div>
    </Screen>
  );
}
