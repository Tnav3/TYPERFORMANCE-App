// Training glossary ("Learn"): which terms a piece of workout text uses, so the
// logger can offer a one-tap explanation. Pure and unit-tested.
export interface GlossaryTerm {
  key: string;
  title: string;
  aliases: string[];
  what: string;
  how: string | null;
  why: string | null;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Keys of the terms used in `text`, in glossary order. `superset` adds the superset entry. */
export function termsIn(text: string, terms: GlossaryTerm[], opts: { superset?: boolean } = {}): string[] {
  const hay = ` ${text.toLowerCase()} `;
  const found = new Set<string>();
  for (const t of terms) {
    for (const a of t.aliases) {
      const re = new RegExp(`(^|[^a-z0-9])${esc(a.toLowerCase())}(?=$|[^a-z0-9])`);
      if (re.test(hay)) found.add(t.key);
    }
  }
  // "5+" style reps = a plus set
  if (/(^|[^0-9])\d{1,2}\+(?![0-9])/.test(hay)) found.add("plus-set");
  // A 3-4 character tempo code after the word tempo is already caught by the alias
  if (opts.superset) found.add("superset");
  return terms.filter((t) => found.has(t.key)).map((t) => t.key);
}

/** Search the glossary by title, alias or text. Empty query → all. */
export function searchTerms(q: string, terms: GlossaryTerm[]): GlossaryTerm[] {
  const n = q.trim().toLowerCase();
  if (!n) return terms;
  const score = (t: GlossaryTerm) =>
    t.title.toLowerCase().includes(n) || t.aliases.some((a) => a.toLowerCase().includes(n)) ? 0 : 1;
  return terms
    .filter((t) => [t.title, ...t.aliases, t.what, t.how ?? "", t.why ?? ""].some((s) => s.toLowerCase().includes(n)))
    .sort((a, b) => score(a) - score(b));
}

/** Split text into plain and link parts so URLs in coach-written text are tappable. */
export function linkParts(text: string): { t: string; href?: string }[] {
  const out: { t: string; href?: string }[] = [];
  const re = /https?:\/\/[^\s)]+/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ t: text.slice(last, m.index) });
    out.push({ t: m[0], href: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}
