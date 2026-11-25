import { requireState } from "@/lib/session";
import { loadGlossary } from "@/lib/glossary-data";
import { searchTerms } from "@/lib/glossary";
import { GlossaryBody } from "@/components/GlossaryEntry";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ q?: string; t?: string; from?: string }> }) {
  const { supabase, state } = await requireState(["athlete", "coach"]);
  const { q = "", t, from } = await searchParams;
  const all = await loadGlossary(supabase);
  const list = searchTerms(q, all);
  const back = from && from.startsWith("/train/") ? { href: from, label: "Back to workout" } : state === "coach" ? { href: "/coach/library/glossary", label: "Edit glossary" } : { href: "/more", label: "More" };

  return (
    <Screen>
      <BackLink href={back.href} label={back.label} />
      <Heading sub="What the words in your program mean, and how to do them.">Learn</Heading>
      <form role="search" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search: AMRAP, tempo, RIR…"
          className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-text"
          aria-label="Search the glossary"
        />
        <button className="min-h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Find</button>
      </form>
      {list.length === 0 && <p className="text-muted">Nothing matches “{q}”. Ask your coach in chat and they can add it.</p>}
      <div className="space-y-2">
        {list.map((term) => (
          <details key={term.key} id={term.key} open={t === term.key || list.length === 1} className="scroll-mt-4 rounded-2xl border border-line bg-surface p-4 open:border-brand/50">
            <summary className="cursor-pointer list-none font-extrabold">
              {term.title}
              <span className="mt-0.5 block text-sm font-normal text-muted line-clamp-1">{term.what}</span>
            </summary>
            <div className="mt-3 border-t border-line pt-3">
              <GlossaryBody t={term} />
            </div>
          </details>
        ))}
      </div>
    </Screen>
  );
}
