import { describe, expect, it } from "vitest";
import { testAlerts, wellnessAlerts } from "@/lib/alerts";

const names = new Map([["cmj", "CMJ"], ["quiet_stand", "Quiet stand"]]);
describe("alerts", () => {
  it("flags a CMJ drop of 8% or more since the last test", () => {
    const a = testAlerts([
      { athlete_id: "a", test_key: "cmj", tested_on: "2026-11-01", values: { jump_height_cm: 40 } },
      { athlete_id: "a", test_key: "cmj", tested_on: "2026-11-20", values: { jump_height_cm: 36 } },
      { athlete_id: "b", test_key: "cmj", tested_on: "2026-11-01", values: { jump_height_cm: 40 } },
      { athlete_id: "b", test_key: "cmj", tested_on: "2026-11-20", values: { jump_height_cm: 38 } },
    ], names, "2026-11-12");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ athleteId: "a", text: "CMJ down 10%", severity: "amber" });
  });
  it("treats a rise as bad for lower-is-better tests", () => {
    const a = testAlerts([
      { athlete_id: "a", test_key: "quiet_stand", tested_on: "2026-11-01", values: { cop_area_mm2: 100 } },
      { athlete_id: "a", test_key: "quiet_stand", tested_on: "2026-11-20", values: { cop_area_mm2: 130 } },
    ], names, "2026-11-12");
    expect(a[0].text).toBe("Quiet stand up 30%");
  });
  it("ignores old results", () => {
    expect(testAlerts([
      { athlete_id: "a", test_key: "cmj", tested_on: "2026-09-01", values: { jump_height_cm: 40 } },
      { athlete_id: "a", test_key: "cmj", tested_on: "2026-10-01", values: { jump_height_cm: 30 } },
    ], names, "2026-11-12")).toHaveLength(0);
  });
  it("flags low or falling wellness", () => {
    const w = wellnessAlerts([
      { athlete_id: "a", week_start: "2026-11-09", wellness: 8 },
      { athlete_id: "a", week_start: "2026-11-16", wellness: 5 },
      { athlete_id: "b", week_start: "2026-11-16", wellness: 3 },
      { athlete_id: "c", week_start: "2026-11-16", wellness: 7 },
    ], "2026-11-09");
    expect(w.map((x) => [x.athleteId, x.text, x.severity])).toEqual([["a", "Wellness 5/10, down from 8", "amber"], ["b", "Wellness 3/10", "red"]]);
  });
});
