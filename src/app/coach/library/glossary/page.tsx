import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";
import { addTerm, deleteTerm, updateTerm } from "./actions";

export const dynamic = "force-dynamic";
const input = "min-h-10 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-text";

type Row = { id: string; key: string; title: string; aliases: string[]; what: string; how: string | null; why: string | null };

function Fields({ t }: { t?: Row }) {
  return (
    <div className="space-y-2">
      <input name="title" defaultValue={t?.title} required maxLength={80} placeholder="Term, e.g. EMOM (Every Minute on the Minute)" className={input} aria-label="Term" />
      <input name="aliases" defaultValue={t?.aliases.join(", ")} maxLength={250} placeholder="Words that trigger it in a workout, comma separated: EMOM, every minute" className={input} aria-label="Matching words" />
      <textarea name="what" defaultValue={t?.what} required maxLength={2000} rows={2} placeholder="What it is" className={input} aria-label="What" />
      <textarea name="how" defaultValue={t?.how ?? ""} maxLength={2000} rows={3} placeholder="How to do it" className={input} aria-label="How" />
      <textarea name="why" defaultValue={t?.why ?? ""} maxLength={1000} rows={2} placeholder="Why it's in your program" className={input} aria-label="Why" />
    </div>
  );
}

export default async function GlossaryAdmin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("glossary_terms").select("id, key, title, aliases, what, how, why").order("sort_order").order("title");
  const rows = (data ?? []) as Row[];
  return (
    <Screen>
      <BackLink href="/coach/library" label="Exercise library" />
      <Heading sub="Clients find these on Learn. When a workout uses one of the matching words, a ? button appears under that exercise.">
        Training glossary
      </Heading>
      {error && <Alert>{error}</Alert>}
      <p className="mb-4 text-sm"><Link href="/learn" className="font-bold text-brand underline underline-offset-4">See it as a client →</Link></p>
      <details className="mb-5 rounded-2xl border border-brand/50 bg-surface p-4">
        <summary className="cursor-pointer list-none font-extrabold">+ Add a term</summary>
        <form action={addTerm} className="mt-3">
          <Fields />
          <button className="mt-3 min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Add</button>
        </form>
      </details>
      <div className="space-y-2">
        {rows.map((t) => (
          <details key={t.id} id={t.key} className="scroll-mt-4 rounded-2xl border border-line bg-surface p-4">
            <summary className="cursor-pointer list-none">
              <span className="font-extrabold">{t.title}</span>
              <span className="mt-0.5 block text-xs text-muted">Matches: {t.aliases.join(", ") || "nothing (Learn page only)"}</span>
            </summary>
            <form action={updateTerm} className="mt-3">
              <input type="hidden" name="id" value={t.id} />
              <Fields t={t} />
              <button className="mt-3 min-h-10 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Save</button>
            </form>
            <form action={deleteTerm} className="mt-2">
              <input type="hidden" name="id" value={t.id} />
              <button className="text-xs font-bold text-muted underline underline-offset-4">Delete term</button>
            </form>
          </details>
        ))}
      </div>
    </Screen>
  );
}
