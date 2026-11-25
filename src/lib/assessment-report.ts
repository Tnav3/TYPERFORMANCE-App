// Builds the client assessment report: the coach picks testing dates, and every test or
// mobility measure done on those dates becomes a row with its values over time and the
// change from the earliest picked date to the latest.
import { headlineValue } from "./testing";
import { LOWER_IS_BETTER } from "./forcedecks";
import { REGIONS, type RomEntry, type RomMeasure } from "./mobility";
import type { TestDef, TestEntry } from "./test-data";

export type Point = { date: string; value: number };
export type ReportRow = {
  key: string;
  name: string;
  unit: string;
  points: Point[];
  first: Point | null;
  last: Point | null;
  changePct: number | null;
  /** true improved, false got worse, null no comparison or no change */
  better: boolean | null;
};
export type ReportSection = { title: string; rows: ReportRow[] };

const round1 = (n: number) => Math.round(n * 10) / 10;

function row(key: string, name: string, unit: string, points: Point[], lowerBetter: boolean): ReportRow {
  const pts = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = pts[0] ?? null;
  const last = pts[pts.length - 1] ?? null;
  const changePct = first && last && pts.length > 1 && first.value ? round1(((last.value - first.value) / Math.abs(first.value)) * 100) : null;
  const better = changePct == null || changePct === 0 ? null : lowerBetter ? changePct < 0 : changePct > 0;
  return { key, name, unit, points: pts, first, last, changePct, better };
}

/** Every date the client has a test or mobility result on, newest first. */
export function testingDates(entries: Pick<TestEntry, "tested_on">[], rom: Pick<RomEntry, "measured_on">[]): string[] {
  return [...new Set([...entries.map((e) => e.tested_on), ...rom.map((r) => r.measured_on)])].sort().reverse();
}

export function buildReport(
  dates: string[],
  defs: Pick<TestDef, "key" | "name" | "mode" | "category" | "sort_order">[],
  entries: Pick<TestEntry, "test_key" | "tested_on" | "values">[],
  measures: Pick<RomMeasure, "key" | "name" | "region" | "unit" | "sided" | "sort_order">[],
  rom: Pick<RomEntry, "measure_key" | "measured_on" | "left_value" | "right_value" | "value">[],
): ReportSection[] {
  const pick = new Set(dates);
  const sections: ReportSection[] = [];
  const groups: { title: string; match: (d: (typeof defs)[number]) => boolean }[] = [
    { title: "Strength", match: (d) => d.mode === "field" && d.category === "strength" },
    { title: "Power", match: (d) => d.mode === "field" && d.category === "power" },
    { title: "Conditioning", match: (d) => d.mode === "field" && d.category === "conditioning" },
    { title: "Other tests", match: (d) => d.mode === "field" && !d.category },
    { title: "ForceDecks", match: (d) => d.mode === "forcedecks" },
  ];
  const sorted = [...defs].sort((a, b) => a.sort_order - b.sort_order);
  for (const g of groups) {
    const rows: ReportRow[] = [];
    for (const d of sorted.filter(g.match)) {
      // Last entry of the day counts for that date
      const byDate = new Map<string, Point & { unit: string }>();
      for (const e of entries.filter((x) => x.test_key === d.key && pick.has(x.tested_on))) {
        const h = headlineValue(d.key, e.values);
        if (h) byDate.set(e.tested_on, { date: e.tested_on, value: h.value, unit: h.unit });
      }
      if (!byDate.size) continue;
      const pts = [...byDate.values()];
      rows.push(row(d.key, d.name.replace(/ \(ForceDecks\)$/, ""), pts[pts.length - 1].unit, pts.map(({ date, value }) => ({ date, value })), LOWER_IS_BETTER.has(d.key)));
    }
    if (rows.length) sections.push({ title: g.title, rows });
  }
  // Mobility, by body region. Sided measures get a row per side.
  const romRows: ReportRow[] = [];
  for (const reg of REGIONS) {
    for (const m of measures.filter((x) => x.region === reg.key).sort((a, b) => a.sort_order - b.sort_order)) {
      const es = rom.filter((r) => r.measure_key === m.key && pick.has(r.measured_on));
      if (!es.length) continue;
      const unit = m.unit === "deg" ? "°" : "cm";
      const pointsOf = (get: (r: (typeof es)[number]) => number | null) => {
        const map = new Map<string, Point>();
        for (const r of es) {
          const v = get(r);
          if (v != null) map.set(r.measured_on, { date: r.measured_on, value: Number(v) });
        }
        return [...map.values()];
      };
      if (m.sided) {
        const l = pointsOf((r) => r.left_value);
        const r = pointsOf((r) => r.right_value);
        if (l.length) romRows.push(row(`${m.key}:l`, `${m.name} (left)`, unit, l, false));
        if (r.length) romRows.push(row(`${m.key}:r`, `${m.name} (right)`, unit, r, false));
      } else {
        const p = pointsOf((r) => r.value);
        if (p.length) romRows.push(row(m.key, m.name, unit, p, false));
      }
    }
  }
  if (romRows.length) sections.push({ title: "Mobility", rows: romRows });
  return sections;
}

export function reportTally(sections: ReportSection[]) {
  const rows = sections.flatMap((s) => s.rows);
  return {
    improved: rows.filter((r) => r.better === true).length,
    declined: rows.filter((r) => r.better === false).length,
    compared: rows.filter((r) => r.changePct != null).length,
    best: rows.filter((r) => r.better).sort((a, b) => Math.abs(b.changePct!) - Math.abs(a.changePct!)).slice(0, 3),
  };
}
