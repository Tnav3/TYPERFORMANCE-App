import { describe, it, expect } from "vitest";
import {
  describeSet,
  fieldsFor,
  fromCanonical,
  suggestedDisplayWeight,
  toCanonical,
  DEFAULT_UNITS,
} from "@/lib/programming/fields";

const lb = { ...DEFAULT_UNITS, weight_unit: "lb" as const };
const mi = { ...DEFAULT_UNITS, distance_unit: "mi" as const, speed_unit: "mph" as const };

describe("exercise fields", () => {
  it("defaults by measure, custom list wins (max 4)", () => {
    expect(fieldsFor({ measure: "load" })).toEqual(["reps", "weight"]);
    expect(fieldsFor({ measure: "calories" })).toEqual(["calories"]);
    expect(fieldsFor({ measure: "load", fields: ["calories", "time", "watts", "heart_rate", "rpe"] })).toEqual([
      "calories",
      "time",
      "watts",
      "heart_rate",
    ]);
  });
  it("converts units both ways", () => {
    expect(toCanonical("weight", "225", lb)).toBe(102.06);
    expect(fromCanonical("weight", 102.06, lb)).toBe("225");
    expect(toCanonical("distance", "3.1", mi)).toBe(4989);
    expect(toCanonical("speed", "10", mi)).toBe(16.09);
    expect(fromCanonical("speed", 16.09, mi)).toBe("10");
    expect(toCanonical("speed", "5", DEFAULT_UNITS)).toBe(18); // m/s default
    expect(fromCanonical("speed", 18, DEFAULT_UNITS)).toBe("5");
    expect(fromCanonical("speed", 18, { ...DEFAULT_UNITS, speed_unit: "kmh" })).toBe("18");
    expect(toCanonical("time", "1:30", DEFAULT_UNITS)).toBe(90);
    expect(toCanonical("reps", "", DEFAULT_UNITS)).toBeNull();
    expect(toCanonical("watts", "-5", DEFAULT_UNITS)).toBeNull();
  });
  it("suggested loads in pounds round to 5", () => {
    expect(suggestedDisplayWeight(100, lb)).toBe("220");
    expect(suggestedDisplayWeight(100, DEFAULT_UNITS)).toBe("100");
  });
  it("describes sets", () => {
    expect(describeSet({ reps: 5, load_kg: 100 }, ["reps", "weight"], DEFAULT_UNITS)).toBe("5 × 100 kg");
    expect(
      describeSet({ reps: null, load_kg: null, metrics: { calories: 12, time: 45, watts: 310 } }, ["calories", "time", "watts"], DEFAULT_UNITS),
    ).toBe("12 cal · 45s · 310 W");
  });
});

import { bandLabel, toCanonical as tc, describeSet as ds, DEFAULT_UNITS as DU } from "@/lib/programming/fields";
describe("band tension", () => {
  it("stores 1-4 and shows words", () => {
    expect(tc("band", "Heavy", DU)).toBe(3);
    expect(tc("band", "x heavy", DU)).toBe(4);
    expect(tc("band", "2", DU)).toBe(2);
    expect(tc("band", "9", DU)).toBeNull();
    expect(bandLabel(1)).toBe("Light");
    expect(ds({ reps: 15, load_kg: null, metrics: { band: 2 } }, ["reps", "band"], DU)).toBe("15 · Medium band");
  });
});
