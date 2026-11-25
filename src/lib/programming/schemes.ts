// Loading schemes: parse/print the coach's text format and turn a week into item columns. Pure, unit-tested.
// Text format: one week per line, sets separated by commas.
//   5@75%, 5@80%, 5+@85%      percent
//   5@7, 4@8, 3@9             RPE (number without %)
//   8 @ rpe 7.5               RPE (explicit)
//   10@40kg                   kg
//   5, 5, 5                   reps only
import type { SetTarget } from "./types";

export type SchemeLoad = "percent" | "rpe" | "none";

export function parseSet(raw: string): SetTarget | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;
  const m = s.match(/^([0-9]{1,3}(?:\s*-\s*[0-9]{1,3})?\+?|amrap|max)\s*(?:@\s*(.*))?$/);
  if (!m) return null;
  const r = m[1].replace(/\s+/g, "").toUpperCase().replace("AMRAP", "AMRAP");
  const load = (m[2] ?? "").trim();
  const out: SetTarget = { r: r === "MAX" ? "MAX" : r };
  if (!load) return out;
  let v: RegExpMatchArray | null;
  if ((v = load.match(/^([0-9]{1,3}(?:[.,][0-9])?)\s*%$/))) out.p = clampN(num(v[1]), 1, 120);
  else if ((v = load.match(/^([0-9]{1,3}(?:[.,][0-9]{1,2})?)\s*kgs?$/))) out.k = clampN(num(v[1]), 0, 600);
  else if ((v = load.match(/^(?:rpe\s*)?([0-9]{1,2}(?:[.,]5)?)$/))) out.e = clampN(num(v[1]), 1, 10);
  else return null;
  return out;
}
const num = (x: string) => Number(x.replace(",", "."));
const clampN = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Text → weeks. Returns the first bad line number on error. */
export function parseScheme(text: string): { weeks: SetTarget[][] } | { error: string } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { error: "Add at least one week." };
  if (lines.length > 12) return { error: "Up to 12 weeks." };
  const weeks: SetTarget[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const sets = lines[i].replace(/^w(?:ee)?k\s*\d+\s*[:.-]?\s*/i, "").split(/[,;]/).map(parseSet);
    if (!sets.length || sets.some((x) => !x)) return { error: `Week ${i + 1}: couldn't read "${lines[i]}". Use e.g. 5@75%, 4@80%.` };
    if (sets.length > 20) return { error: `Week ${i + 1}: up to 20 sets.` };
    weeks.push(sets as SetTarget[]);
  }
  return { weeks };
}

const t = (n: number) => String(Number(n.toFixed(2)));
export const setText = (s: SetTarget) => `${s.r}${s.p != null ? `@${t(s.p)}%` : s.e != null ? `@${t(s.e)}` : s.k != null ? `@${t(s.k)}kg` : ""}`;
export const schemeText = (weeks: SetTarget[][]) => weeks.map((w) => w.map(setText).join(", ")).join("\n");

export function schemeLoadOf(weeks: SetTarget[][]): SchemeLoad {
  const all = weeks.flat();
  return all.some((s) => s.p != null) ? "percent" : all.some((s) => s.e != null) ? "rpe" : "none";
}

/** Item columns for one week. Sets/reps/load summarise the plan so every view still reads right. */
export function schemeRow(plan: SetTarget[], loadType: SchemeLoad) {
  const reps = plan.map((s) => s.r);
  const same = reps.every((r) => r === reps[0]);
  const ps = plan.map((s) => s.p).filter((x): x is number => x != null);
  const es = plan.map((s) => s.e).filter((x): x is number => x != null);
  return {
    set_plan: plan,
    sets: plan.length,
    reps: (same ? reps[0] : reps.join("/")).slice(0, 20),
    load_type: loadType === "percent" && ps.length ? "percent" : loadType === "rpe" && es.length ? "rpe" : "none",
    percent: loadType === "percent" && ps.length ? Math.max(...ps) : null,
    rpe: loadType === "rpe" && es.length ? Math.max(...es) : null,
    load_kg: null,
  };
}
