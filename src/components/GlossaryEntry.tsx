import type { GlossaryTerm } from "@/lib/glossary";
import { LinkedText } from "@/components/LinkedText";

/** What / How / Why for one term. */
export function GlossaryBody({ t }: { t: GlossaryTerm }) {
  const rows: [string, string | null][] = [["What", t.what], ["How", t.how], ["Why", t.why]];
  const labelled = !!(t.how || t.why);
  return (
    <div className="space-y-2 text-sm">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <p key={k}>
          {labelled && <span className="mr-1.5 text-[11px] font-black uppercase tracking-widest text-brand">{k}</span>}
          <LinkedText text={v!} />
        </p>
      ))}
    </div>
  );
}
