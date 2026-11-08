// Weekly load aggregation and the traffic-light rule (spec decision 16).
// Pure functions: unit-tested.

export interface SessionLite {
  athlete_id: string;
  week_start: string;
  discipline_id: string;
  session_type_id: string;
  duration_min: number;
  load_au: number;
}

export interface WeekTotals {
  load: number;
  minutes: number;
  count: number;
  byDiscipline: Record<string, number>; // discipline_id → load
  byType: Record<string, number>; // session_type_id → load
}

export const emptyWeek = (): WeekTotals => ({
  load: 0,
  minutes: 0,
  count: 0,
  byDiscipline: {},
  byType: {},
});

/** athlete_id → week_start → totals */
export function weeklyTotals(
  sessions: SessionLite[],
): Map<string, Map<string, WeekTotals>> {
  const out = new Map<string, Map<string, WeekTotals>>();
  for (const s of sessions) {
    let a = out.get(s.athlete_id);
    if (!a) out.set(s.athlete_id, (a = new Map()));
    let w = a.get(s.week_start);
    if (!w) a.set(s.week_start, (w = emptyWeek()));
    w.load += s.load_au;
    w.minutes += s.duration_min;
    w.count += 1;
    w.byDiscipline[s.discipline_id] =
      (w.byDiscipline[s.discipline_id] ?? 0) + s.load_au;
    w.byType[s.session_type_id] =
      (w.byType[s.session_type_id] ?? 0) + s.load_au;
  }
  return out;
}

export type Light = "red" | "amber" | "green" | "none";

export const AMBER_ABOVE_PCT = 15;
export const RED_ABOVE_PCT = 30;

/**
 * Agreed rule: Amber when weekly load rises MORE than 15% on the previous week,
 * Red when it rises MORE than 30% OR a niggle is flagged.
 * No baseline (previous week 0) → "none" unless there's a niggle.
 */
export function trafficLight(
  lastLoad: number,
  prevLoad: number,
  niggle: boolean,
) {
  // Rounded to 0.01% so floating-point noise (e.g. 15.000000000000002) can't flip a light
  const changePct =
    prevLoad > 0
      ? Math.round(((lastLoad - prevLoad) * 10000) / prevLoad) / 100
      : null;
  const reasons: string[] = [];
  let level: Light;
  if (changePct == null) level = "none";
  else if (changePct > RED_ABOVE_PCT) level = "red";
  else if (changePct > AMBER_ABOVE_PCT) level = "amber";
  else level = "green";

  if (changePct != null && changePct > AMBER_ABOVE_PCT)
    reasons.push(`Load up ${Math.round(changePct)}%`);
  if (changePct == null) reasons.push("No baseline week");
  if (niggle) {
    level = "red";
    reasons.unshift("Niggle reported");
  }
  return { level, changePct, reasons };
}

export const LIGHT_ORDER: Record<Light, number> = {
  red: 0,
  amber: 1,
  none: 2,
  green: 3,
};

export function formatChange(pct: number | null): string {
  if (pct == null) return "–";
  const r = Math.round(pct);
  return `${r > 0 ? "+" : ""}${r}%`;
}

export interface DayTotals {
  date: string;
  load: number;
  minutes: number;
  count: number;
  byDiscipline: Record<string, number>;
}

/** Load per day for the given dates (zeros for rest days), split by discipline. */
export function dailyTotals(
  sessions: {
    session_date: string;
    discipline_id: string;
    duration_min: number;
    load_au: number;
  }[],
  days: string[],
): DayTotals[] {
  return days.map((date) => {
    const s = sessions.filter((x) => x.session_date === date);
    const byDiscipline: Record<string, number> = {};
    for (const x of s)
      byDiscipline[x.discipline_id] =
        (byDiscipline[x.discipline_id] ?? 0) + x.load_au;
    return {
      date,
      load: s.reduce((a, x) => a + x.load_au, 0),
      minutes: s.reduce((a, x) => a + x.duration_min, 0),
      count: s.length,
      byDiscipline,
    };
  });
}
