import { describe, it, expect } from "vitest";
import { baseFor, latestByLift, lineLoad } from "@/lib/programming/loads";

const lifts = new Map([
  ["back_squat", { key: "back_squat", kind: "barbell" as const, parent_key: null }],
  ["squat_jump", { key: "squat_jump", kind: "jump" as const, parent_key: "back_squat" }],
  ["weighted_chin_up", { key: "weighted_chin_up", kind: "bodyweight" as const, parent_key: null }],
]);
const latest = latestByLift([
  { lift_key: "back_squat", e1rm_kg: 150 },
  { lift_key: "back_squat", e1rm_kg: 120 }, // older
  { lift_key: "weighted_chin_up", e1rm_kg: 110 },
]);

describe("loads from e1RM", () => {
  it("uses the newest e1RM", () => {
    expect(baseFor("back_squat", lifts, latest)).toEqual({ e1rm: 150, bodyweightLift: false });
  });
  it("percent → kg rounded to 2.5", () => {
    const b = baseFor("back_squat", lifts, latest);
    expect(lineLoad({ load_type: "percent", percent: 82, load_kg: null }, b, null)).toEqual({ kg: 122.5, addedToBodyweight: false });
  });
  it("jumps use the parent lift", () => {
    const b = baseFor("squat_jump", lifts, latest);
    expect(lineLoad({ load_type: "percent", percent: 30, load_kg: null }, b, null)!.kg).toBe(45);
  });
  it("bodyweight lifts give added load", () => {
    const b = baseFor("weighted_chin_up", lifts, latest);
    expect(lineLoad({ load_type: "percent", percent: 85, load_kg: null }, b, 80)).toEqual({ kg: 12.5, addedToBodyweight: true });
    expect(lineLoad({ load_type: "percent", percent: 85, load_kg: null }, b, null)).toBeNull();
  });
  it("no e1RM or not a % line → nothing (fixed kg passes through)", () => {
    expect(lineLoad({ load_type: "percent", percent: 80, load_kg: null }, null, null)).toBeNull();
    expect(lineLoad({ load_type: "kg", percent: null, load_kg: "40.00" }, null, null)!.kg).toBe(40);
  });
  it("respects a kg cap on a % line", () => {
    const b = baseFor("back_squat", lifts, latest);
    expect(lineLoad({ load_type: "percent", percent: 80, load_kg: 100 }, b, null)!.kg).toBe(100);
  });
});
