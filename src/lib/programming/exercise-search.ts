// Fast, forgiving exercise search for the builder, plus "paste a session" line splitting. Pure, unit-tested.
export interface SearchEx {
  id: string;
  name: string;
  active: boolean;
  category?: string | null;
}

// Coach shorthand → words in exercise names
const ALIASES: Record<string, string[]> = {
  rdl: ["romanian", "deadlift"],
  sldl: ["stiff", "leg", "deadlift"],
  ohp: ["overhead", "press"],
  bss: ["bulgarian", "split", "squat"],
  rfess: ["rear", "foot", "elevated", "split", "squat"],
  db: ["dumbbell"],
  kb: ["kettlebell"],
  bb: ["barbell"],
  sl: ["single", "leg"],
  sa: ["single", "arm"],
  mb: ["med", "ball"],
  bw: ["bodyweight"],
  trx: ["trx"],
  ghr: ["glute", "ham", "raise"],
  hsr: ["heavy", "slow"],
  cmj: ["countermovement", "jump"],
  pu: ["push", "up"],
  "chin": ["chin"],
};

const norm = (s: string) =>
  s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\b(dumbell|dumbel)\b/g, "dumbbell").trim();

function tokens(q: string): string[][] {
  // each token becomes one or more required words (aliases expand)
  return norm(q)
    .split(" ")
    .filter(Boolean)
    .map((t) => ALIASES[t] ?? [t]);
}

/** Optimal string alignment distance (counts a swapped pair as one edit). */
function osa(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

/** Close enough: prefix, or one typo for words of 5+ letters (whole word or same-length prefix). */
function wordMatch(word: string, t: string): number {
  if (word.startsWith(t)) return t.length === word.length ? 3 : 2;
  if (t.length >= 5 && (osa(word, t) <= 1 || osa(word.slice(0, t.length), t) <= 1)) return 1;
  return 0;
}

export function scoreExercise(name: string, q: string): number {
  const words = norm(name).split(" ");
  const groups = tokens(q);
  if (!groups.length) return 0;
  let score = 0;
  for (const g of groups)
    for (const t of g) {
      const best = Math.max(0, ...words.map((w) => wordMatch(w, t)));
      if (!best) return 0;
      score += best;
    }
  const nq = norm(q);
  if (norm(name).startsWith(nq)) score += 5;
  return score * 100 - words.length; // shorter names win ties
}

export function searchExercises(list: SearchEx[], q: string, opts: { recent?: string[]; category?: string | null; limit?: number } = {}): SearchEx[] {
  const limit = opts.limit ?? 12;
  const pool = list.filter((e) => e.active && (!opts.category || e.category === opts.category));
  const recent = opts.recent ?? [];
  if (!q.trim()) {
    const byId = new Map(pool.map((e) => [e.id, e]));
    const rec = recent.map((id) => byId.get(id)).filter((e): e is SearchEx => !!e);
    const rest = opts.category ? pool.filter((e) => !recent.includes(e.id)).sort((a, b) => a.name.localeCompare(b.name)) : [];
    return [...rec, ...rest].slice(0, limit);
  }
  return pool
    .map((e) => ({ e, s: scoreExercise(e.name, q) + (recent.includes(e.id) ? 50 : 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map((x) => x.e);
}

/**
 * One pasted line → exercise + prescription text. Finds the longest library name at the
 * start of the line ("Back Squat 4x6 @80%"), else splits at the first sets×reps.
 */
export function splitLine(line: string, names: string[]): { exercise: string; rx: string } | null {
  const raw = line.replace(/^\s*(?:[A-Z]\d?[.)]|\d+[.)]|[-•*])\s+/, "").trim();
  if (!raw) return null;
  const low = raw.toLowerCase();
  let best = "";
  for (const n of names) if (low.startsWith(n.toLowerCase()) && n.length > best.length && /^(\s|$|[-–:,@])/.test(raw.slice(n.length))) best = n;
  if (best) return { exercise: best, rx: raw.slice(best.length).replace(/^\s*[-–:,]\s*/, "").trim() };
  const m = raw.match(/\s[-–:]?\s*(\d{1,2}\s*[x×*]\s*\S+.*|\d{1,2}\s*sets?.*)$/i);
  if (m) return { exercise: raw.slice(0, m.index).replace(/\s*[-–:,]\s*$/, "").trim(), rx: m[1].trim() };
  return { exercise: raw, rx: "" };
}
