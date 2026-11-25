import { describe, expect, it } from "vitest";
import { buildReport, reportTally, testingDates } from "@/lib/assessment-report";

const defs = [
  { key: "cmj", name: "CMJ (ForceDecks)", mode: "forcedecks" as const, category: null, sort_order: 1 },
  { key: "quiet_stand", name: "Quiet stand (ForceDecks)", mode: "forcedecks" as const, category: null, sort_order: 2 },
  { key: "chin_ups", name: "Max chin-ups", mode: "field" as const, category: "strength" as const, sort_order: 3 },
];

describe("assessment report", () => {
  it("compares the earliest and latest picked dates, lower-is-better aware", () => {
    const entries: { test_key: string; tested_on: string; values: Record<string, number> }[] = [
      { test_key: "cmj", tested_on: "2026-08-01", values: { jump_height_cm: 40 } },
      { test_key: "cmj", tested_on: "2026-11-01", values: { jump_height_cm: 44 } },
      { test_key: "cmj", tested_on: "2026-10-01", values: { jump_height_cm: 50 } },
      { test_key: "quiet_stand", tested_on: "2026-08-01", values: { cop_area_mm2: 200 } },
      { test_key: "quiet_stand", tested_on: "2026-11-01", values: { cop_area_mm2: 150 } },
      { test_key: "chin_ups", tested_on: "2026-11-01", values: { reps: 12 } },
    ];
    const s = buildReport(["2026-08-01", "2026-11-01"], defs, entries, [], []);
    expect(s.map((x) => x.title)).toEqual(["Strength", "ForceDecks"]);
    const fd = s[1].rows;
    expect(fd[0]).toMatchObject({ name: "CMJ", changePct: 10, better: true });
    expect(fd[0].points).toHaveLength(2);
    expect(fd[1]).toMatchObject({ changePct: -25, better: true });
    expect(s[0].rows[0].changePct).toBeNull();
    expect(reportTally(s)).toMatchObject({ improved: 2, declined: 0, compared: 2 });
  });
  it("splits sided mobility into left and right rows", () => {
    const s = buildReport(["2026-08-01", "2026-11-01"], [], [], [{ key: "hip_ir", name: "Hip IR", region: "hip", unit: "deg", sided: true, sort_order: 1 }], [
      { measure_key: "hip_ir", measured_on: "2026-08-01", left_value: 30, right_value: 40, value: null },
      { measure_key: "hip_ir", measured_on: "2026-11-01", left_value: 27, right_value: 44, value: null },
    ]);
    expect(s[0].rows.map((r) => [r.name, r.better])).toEqual([["Hip IR (left)", false], ["Hip IR (right)", true]]);
  });
  it("lists testing dates newest first", () => {
    expect(testingDates([{ tested_on: "2026-01-01" }], [{ measured_on: "2026-02-01" }, { measured_on: "2026-01-01" }])).toEqual(["2026-02-01", "2026-01-01"]);
  });
});
