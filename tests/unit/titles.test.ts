import { describe, it, expect } from "vitest";
import { heaviestLift, validateTitle } from "@/lib/titles";

describe("titles", () => {
  it("validates and tidies", () => {
    expect(validateTitle({ org: " ISKA ", name: "Australian  Welterweight", colour: "red", won_on: "2026-10-01", today: "2026-11-25" })).toEqual({
      row: { org: "ISKA", name: "Australian Welterweight", colour: "red", won_on: "2026-10-01" },
    });
    expect(validateTitle({ org: "W", name: "", colour: "gold", won_on: "", today: "2026-11-25" }).error).toBeTruthy();
    expect(validateTitle({ org: "WBC", name: "", colour: "pink", won_on: "", today: "2026-11-25" }).row?.colour).toBe("gold");
    expect(validateTitle({ org: "WBC", name: "", colour: "gold", won_on: "2027-01-01", today: "2026-11-25" }).error).toBeTruthy();
  });
  it("finds the heaviest set with reps", () => {
    expect(heaviestLift([
      { kg: 200, reps: 0, key: "a" },
      { kg: 180, reps: 1, key: "b" },
      { kg: 120, reps: 5, key: "c" },
    ])).toEqual({ kg: 180, exercise_id: "b" });
    expect(heaviestLift([])).toBeNull();
  });
});
