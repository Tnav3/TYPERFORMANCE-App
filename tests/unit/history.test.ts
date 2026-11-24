import { describe, it, expect } from "vitest";
import { newPBs, repPRs, rollingAverage, sessions } from "@/lib/programming/history";

const s = (date: string, reps: number, kg: number) => ({ date, reps, kg, value: null });

describe("exercise history", () => {
  it("summarises sessions newest first with best e1RM and volume", () => {
    const r = sessions([s("2026-11-01", 5, 100), s("2026-11-01", 5, 105), s("2026-11-08", 3, 110)]);
    expect(r.map((x) => [x.date, x.bestE1rm, x.volume])).toEqual([
      ["2026-11-08", 118.5, 330],
      ["2026-11-01", 120.5, 1025],
    ]);
    expect(r[1].topSet).toEqual({ reps: 5, kg: 105 });
  });
  it("rep PRs keep the first date a load was hit", () => {
    expect(repPRs([s("2026-11-08", 5, 100), s("2026-11-01", 5, 100), s("2026-11-01", 3, 110)])).toEqual([
      { reps: 3, kg: 110, date: "2026-11-01" },
      { reps: 5, kg: 100, date: "2026-11-01" },
    ]);
  });
  it("new PBs only count when they beat earlier history, and only since a date", () => {
    const rows = [
      { key: "squat", ...s("2026-10-01", 5, 100) },
      { key: "squat", ...s("2026-11-20", 5, 110) }, // PB
      { key: "bench", ...s("2026-11-21", 5, 80) }, // first ever: not a PB
      { key: "dl", ...s("2026-10-01", 5, 150) },
      { key: "dl", ...s("2026-10-10", 5, 160) }, // PB but too old
    ];
    const r = newPBs(rows, "2026-11-17");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ key: "squat", date: "2026-11-20", reps: 5, kg: 110 });
    expect(r[0].e1rm).toBeGreaterThan(r[0].previous);
  });
  it("7-day rolling average", () => {
    const r = rollingAverage([
      { date: "2026-11-01", kg: 80 },
      { date: "2026-11-02", kg: 82 },
      { date: "2026-11-10", kg: 79 },
    ]);
    expect(r.map((x) => x.avg)).toEqual([80, 81, 79]);
  });
});

import { pbEvents } from "@/lib/programming/history";
describe("PB events", () => {
  it("counts each time a best was beaten (first session is not a PB)", () => {
    const rows = [
      { key: "a", date: "2026-11-01", reps: 5, kg: 100, value: null },
      { key: "a", date: "2026-11-08", reps: 5, kg: 105, value: null },
      { key: "a", date: "2026-11-15", reps: 5, kg: 102.5, value: null },
      { key: "a", date: "2026-11-22", reps: 5, kg: 110, value: null },
    ];
    expect(pbEvents(rows).map((p) => p.date)).toEqual(["2026-11-08", "2026-11-22"]);
  });
});
