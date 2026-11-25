/** Turn an exercise's free-text cues into tidy sections the client can scan:
 *  numbered steps, tips and the coach's own notes. */
export type CueSection = { title: string | null; kind: "steps" | "tip" | "notes" | "text"; items: string[]; numbered: boolean };

const HEADING = /^(steps?|how to( do it)?|instructions?|set ?up|execution|tips?|coaching tips?|coach notes|notes?|muscle focus|muscles?( worked)?|cues?|key points?|regress(ion)?s?|progress(ion)?s?)\s*:?\s*$/i;
const NUM = /^\s*\d{1,2}[.)]\s+/;
const BULLET = /^\s*[-•*]\s+/;

function kindOf(title: string | null, numbered: boolean): CueSection["kind"] {
  const t = (title ?? "").toLowerCase();
  if (/^tips?|coaching tip/.test(t)) return "tip";
  if (/^coach notes|^notes?/.test(t)) return "notes";
  if (numbered || /^steps?|how to|instruction|set ?up|execution/.test(t)) return "steps";
  return "text";
}

export function parseCues(raw: string | null | undefined): CueSection[] {
  const out: CueSection[] = [];
  let cur: { title: string | null; items: string[]; numbered: boolean } | null = null;
  const flush = () => {
    if (cur && cur.items.length) out.push({ ...cur, kind: kindOf(cur.title, cur.numbered) });
    cur = null;
  };
  for (const line of (raw ?? "").replace(/\r/g, "").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    if (HEADING.test(s)) {
      flush();
      cur = { title: s.replace(/:$/, ""), items: [], numbered: false };
      continue;
    }
    if (!cur) cur = { title: null, items: [], numbered: false };
    if (NUM.test(s)) {
      cur.numbered = true;
      cur.items.push(s.replace(NUM, ""));
    } else if (BULLET.test(s)) {
      cur.items.push(s.replace(BULLET, ""));
    } else if (cur.numbered && cur.items.length && !/[.!?]$/.test(cur.items[cur.items.length - 1])) {
      // A wrapped step: join it onto the one before.
      cur.items[cur.items.length - 1] += ` ${s}`;
    } else {
      cur.items.push(s);
    }
  }
  flush();
  return out;
}
