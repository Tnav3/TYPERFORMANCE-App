import { describe, it, expect } from "vitest";
import { currentPhase, phaseWeeks, pos, weeksOut } from "@/lib/programming/periodisation";

describe("periodisation", () => {
  it("3:1 pattern steps up then deloads", () => {
    const w = phaseWeeks("2026-12-07", "2027-01-17", "3:1");
    expect(w.map((x) => [x.start, x.kind, x.rel])).toEqual([
      ["2026-12-07", "load", 1],
      ["2026-12-14", "load", 1.1],
      ["2026-12-21", "load", 1.2],
      ["2026-12-28", "deload", 0.6],
      ["2027-01-04", "load", 1],
      ["2027-01-11", "load", 1.1],
    ]);
  });
  it("no deload pattern", () => {
    expect(phaseWeeks("2026-12-09", "2026-12-20", "2:0").map((x) => x.kind)).toEqual(["load", "load"]);
  });
  it("weeks out from a fight", () => {
    expect(weeksOut("2026-12-01", "2027-01-26")).toBe("8 wk out");
    expect(weeksOut("2027-01-22", "2027-01-26")).toBe("Fight week");
    expect(weeksOut("2027-01-26", "2027-01-26")).toBe("Fight day");
    expect(weeksOut("2027-02-01", "2027-01-26")).toBeNull();
  });
  it("timeline position and current phase", () => {
    expect(pos("2026-12-11", "2026-12-01", "2026-12-21")).toBe(50);
    expect(currentPhase([{ start_date: "2026-12-01", end_date: "2026-12-20", n: 1 }], "2026-12-05")).toMatchObject({ n: 1 });
  });
});
