// Automatic performance alerts for the coach dashboard: a test result that dropped
// noticeably since the previous one, or a low / falling wellness score.
import { headlineValue } from "./testing";
import { LOWER_IS_BETTER } from "./forcedecks";

export type Alert = { athleteId: string; text: string; date: string; severity: "red" | "amber"; href: string };

/** Drop (in %) that counts as worth a look. CMJ is sensitive to fatigue, so a smaller drop flags. */
const DROP: Record<string, number> = { cmj: 8, abcmj: 8, sj: 8, rj_10_5: 10, hj: 10, dj: 10 };
const DEFAULT_DROP = 10;

export function testAlerts(
  entries: { athlete_id: string; test_key: string; tested_on: string; values: Record<string, number> }[],
  names: Map<string, string>,
  since: string,
): Alert[] {
  const by = new Map<string, typeof entries>();
  for (const e of entries) by.set(`${e.athlete_id}|${e.test_key}`, [...(by.get(`${e.athlete_id}|${e.test_key}`) ?? []), e]);
  const out: Alert[] = [];
  for (const [k, list] of by) {
    const sorted = [...list].sort((a, b) => a.tested_on.localeCompare(b.tested_on));
    const last = sorted[sorted.length - 1];
    if (last.tested_on < since) continue;
    const prev = [...sorted].reverse().find((e) => e.tested_on < last.tested_on);
    if (!prev) continue;
    const [athleteId, key] = k.split("|");
    const a = headlineValue(key, prev.values);
    const b = headlineValue(key, last.values);
    if (!a || !b || !a.value) continue;
    const pct = ((b.value - a.value) / Math.abs(a.value)) * 100;
    const worse = LOWER_IS_BETTER.has(key) ? pct : -pct;
    const limit = DROP[key] ?? DEFAULT_DROP;
    if (worse >= limit) {
      out.push({
        athleteId,
        date: last.tested_on,
        severity: worse >= limit * 2 ? "red" : "amber",
        text: `${names.get(key) ?? key} ${LOWER_IS_BETTER.has(key) ? "up" : "down"} ${Math.round(Math.abs(pct))}%`,
        href: `/coach/athlete/${athleteId}/tests`,
      });
    }
  }
  return out.sort((x, y) => y.date.localeCompare(x.date));
}

/** Wellness at 4/10 or lower, or down 3+ points on the week before. */
export function wellnessAlerts(rows: { athlete_id: string; week_start: string; wellness: number }[], since: string): Alert[] {
  const by = new Map<string, typeof rows>();
  for (const r of rows) by.set(r.athlete_id, [...(by.get(r.athlete_id) ?? []), r]);
  const out: Alert[] = [];
  for (const [athleteId, list] of by) {
    const s = [...list].sort((a, b) => a.week_start.localeCompare(b.week_start));
    const last = s[s.length - 1];
    if (last.week_start < since) continue;
    const prev = s.length > 1 ? s[s.length - 2] : null;
    const fall = prev ? prev.wellness - last.wellness : 0;
    if (last.wellness <= 4 || fall >= 3) {
      out.push({
        athleteId,
        date: last.week_start,
        severity: last.wellness <= 3 ? "red" : "amber",
        text: fall >= 3 ? `Wellness ${last.wellness}/10, down from ${prev!.wellness}` : `Wellness ${last.wellness}/10`,
        href: `/coach/athlete/${athleteId}`,
      });
    }
  }
  return out;
}
