import Link from "next/link";
import { requireState } from "@/lib/session";
import { Alert, Heading, Screen } from "@/components/ui";
import { createForm } from "./actions";

export const dynamic = "force-dynamic";

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const { error } = await searchParams;
  const [{ data: forms }, { data: qs }, { data: asg }, { data: unseen }] = await Promise.all([
    supabase.from("forms").select("id, name, description, archived").order("archived").order("name"),
    supabase.from("form_questions").select("form_id"),
    supabase.from("form_assignments").select("form_id").eq("active", true),
    supabase.from("form_responses").select("form_id").is("coach_seen_at", null),
  ]);
  const count = (rows: { form_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.form_id === id).length;

  return (
    <Screen wide>
      <Heading sub="Check-ins and questionnaires your clients fill in on their phone, once or on a repeat.">Forms</Heading>
      {error && <Alert>{error}</Alert>}
      <form action={createForm} className="mb-6 flex max-w-xl gap-2">
        <input
          name="name"
          required
          maxLength={80}
          placeholder="New form, e.g. Monthly progress review"
          className="min-h-12 flex-1 rounded-xl border border-line bg-surface-2 px-4 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none"
          aria-label="Form name"
        />
        <button className="min-h-12 rounded-xl bg-brand px-5 font-extrabold uppercase tracking-wide text-white">Create</button>
      </form>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(forms ?? []).map((f) => (
          <Link key={f.id} href={`/coach/forms/${f.id}`} className={`rounded-2xl border border-line bg-surface p-4 hover:border-brand ${f.archived ? "opacity-60" : ""}`}>
            <p className="flex items-center justify-between gap-2 font-extrabold">
              {f.name}
              {count(unseen, f.id) > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-black text-white">{count(unseen, f.id)} new</span>}
            </p>
            {f.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{f.description}</p>}
            <p className="mt-2 text-xs text-muted">
              {count(qs, f.id)} questions · sent to {count(asg, f.id)} client{count(asg, f.id) === 1 ? "" : "s"}
              {f.archived ? " · archived" : ""}
            </p>
          </Link>
        ))}
      </div>
    </Screen>
  );
}
