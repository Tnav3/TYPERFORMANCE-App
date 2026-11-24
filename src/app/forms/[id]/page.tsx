import { notFound, redirect } from "next/navigation";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { currentDue, type FormQuestion, type Repeat } from "@/lib/forms";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";
import { submitForm } from "../actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-base text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export default async function FillForm({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { supabase, user } = await requireState(["athlete"]);
  const { id } = await params;
  const { error } = await searchParams;
  const { data: a } = await supabase.from("form_assignments").select("id, form_id, repeat, starts_on, active, forms(name, description)").eq("id", id).eq("athlete_id", user!.id).maybeSingle();
  if (!a || !a.active) notFound();
  const due = currentDue({ repeat: a.repeat as Repeat, starts_on: a.starts_on }, todayISO());
  if (!due) redirect("/forms");
  const { data: qs } = await supabase.from("form_questions").select("*").eq("form_id", a.form_id).order("position");
  const f = a.forms as unknown as { name: string; description: string | null };

  return (
    <Screen>
      <BackLink href="/forms" label="Check-ins" />
      <Heading sub={f.description ?? `For ${formatDate(due)}`}>{f.name}</Heading>
      {error && <Alert>{error}</Alert>}
      <form action={submitForm} className="space-y-6 pb-10">
        <input type="hidden" name="assignment_id" value={a.id} />
        {((qs ?? []) as FormQuestion[]).map((q, k) => {
          const name = `q_${q.id}`;
          return (
            <fieldset key={q.id}>
              <legend className="mb-1 font-bold">
                <span className="mr-2 text-brand">{k + 1}.</span>
                {q.label}
                {q.required && <span className="text-brand"> *</span>}
              </legend>
              {q.help && <p className="mb-2 text-sm text-muted">{q.help}</p>}
              {q.kind === "short" && <input name={name} maxLength={200} required={q.required} className={input} />}
              {q.kind === "long" && <textarea name={name} rows={3} maxLength={2000} required={q.required} className={`${input} py-3`} />}
              {q.kind === "number" && <input name={name} inputMode="decimal" required={q.required} className={input} />}
              {q.kind === "scale" && (
                <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <label key={n} className="cursor-pointer">
                      <input type="radio" name={name} value={n} required={q.required} className="peer sr-only" />
                      <span className="flex h-12 items-center justify-center rounded-xl border border-line text-lg font-black peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white">{n}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.kind === "yesno" && (
                <div className="grid grid-cols-2 gap-2">
                  {["yes", "no"].map((v) => (
                    <label key={v} className="cursor-pointer">
                      <input type="radio" name={name} value={v} required={q.required} className="peer sr-only" />
                      <span className="flex h-12 items-center justify-center rounded-xl border border-line text-lg font-black capitalize peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white">{v}</span>
                    </label>
                  ))}
                </div>
              )}
              {(q.kind === "choice" || q.kind === "multi") && (
                <div className="space-y-2">
                  {q.options.map((o) => (
                    <label key={o} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 has-[:checked]:border-brand has-[:checked]:bg-brand/10">
                      <input type={q.kind === "choice" ? "radio" : "checkbox"} name={name} value={o} required={q.kind === "choice" && q.required} className="h-5 w-5 accent-[var(--color-brand)]" />
                      {o}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          );
        })}
        <button className="min-h-14 w-full rounded-2xl bg-brand text-lg font-black uppercase tracking-wide text-white">Send to my coach</button>
      </form>
    </Screen>
  );
}
