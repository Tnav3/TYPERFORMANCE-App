import { describe, it, expect } from "vitest";
import {
  parsePrescription as p,
  formatPrescription,
  suggestedLoad,
  e1rm,
  formatRest,
  targetReps,
} from "@/lib/prescription";

describe("one-line prescription entry", () => {
  it("sets x reps @ percent", () => {
    expect(p("4x5 @ 80%")).toMatchObject({
      sets: 4,
      reps: "5",
      load_type: "percent",
      percent: 80,
      notes: null,
    });
  });
  it("RPE", () => {
    expect(p("3x8 RPE 7")).toMatchObject({ sets: 3, reps: "8", load_type: "rpe", rpe: 7 });
    expect(p("3x8 @rpe8.5")).toMatchObject({ rpe: 8.5 });
  });
  it("kg, ranges, AMRAP, times", () => {
    expect(p("3x10 @ 40kg")).toMatchObject({ load_type: "kg", load_kg: 40 });
    expect(p("3x8-10")).toMatchObject({ sets: 3, reps: "8-10" });
    expect(p("3xAMRAP")).toMatchObject({ sets: 3, reps: "AMRAP" });
    expect(p("3 x 30s")).toMatchObject({ sets: 3, reps: "30s" });
    expect(p("3×30 sec")).toMatchObject({ reps: "30s" });
  });
  it("tempo and rest in several forms", () => {
    expect(p("5x3 @ 80% tempo 30X1 rest 3m")).toMatchObject({
      sets: 5,
      reps: "3",
      percent: 80,
      tempo: "30X1",
      rest_sec: 180,
      notes: null,
    });
    expect(p("3x5 rest 90s").rest_sec).toBe(90);
    expect(p("3x5 rest 2:30").rest_sec).toBe(150);
    expect(p("3x5 rest 2").rest_sec).toBe(120);
  });
  it("percent plus a kg cap keeps the percent", () => {
    expect(p("3x5 @ 75% 100kg")).toMatchObject({ load_type: "percent", percent: 75, load_kg: 100 });
  });
  it("bodyweight", () => {
    expect(p("3x12 BW")).toMatchObject({ load_type: "bodyweight" });
  });
  it("keeps anything it can't read as notes", () => {
    expect(p("4x5 @ 80% pause at the bottom")).toMatchObject({
      percent: 80,
      notes: "pause at the bottom",
    });
    expect(p("easy spin")).toMatchObject({ sets: null, notes: "easy spin" });
  });
  it("clamps silly numbers", () => {
    expect(p("50x5 @ 200%")).toMatchObject({ sets: 20, percent: 120 });
  });
});

describe("round trip (what the editor pre-fills parses back the same)", () => {
  it.each([
    "4x5 @ 80% tempo 30X1 rest 3m",
    "3x8 RPE 7.5 rest 2:30",
    "3x10 @ 40kg",
    "3x12 BW",
    "3 sets rest 45s",
  ])("%s", (line) => {
    const a = p(line);
    const shown = formatPrescription(a).replace(/ × /, "x").replace(/(\d) min( |$)/, "$1m$2");
    expect(p(shown)).toEqual(a);
  });
});

describe("display", () => {
  it("formats lines", () => {
    expect(formatPrescription(p("4x5 @ 80% rest 3m"))).toBe("4 × 5 @ 80% rest 3 min");
    expect(formatPrescription(p("3x8 RPE 7.5"))).toBe("3 × 8 @ RPE 7.5");
    expect(formatPrescription({ sets: 3, reps: "10", load_type: "kg", load_kg: 40 })).toBe("3 × 10 @ 40 kg");
    expect(formatRest(150)).toBe("2:30");
    expect(formatRest(45)).toBe("45s");
  });
});

describe("loads", () => {
  it("percent of e1RM rounded to 2.5 kg", () => {
    expect(suggestedLoad({ load_type: "percent", percent: 80, load_kg: null }, 143)).toBe(115);
    expect(suggestedLoad({ load_type: "percent", percent: 80, load_kg: null }, null)).toBeNull();
    expect(suggestedLoad({ load_type: "kg", percent: null, load_kg: 40 }, 200)).toBe(40);
    expect(suggestedLoad({ load_type: "rpe", percent: null, load_kg: null }, 200)).toBeNull();
  });
  it("e1RM matches the calculator's formula", () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 5)).toBe(114.5);
    expect(Number.isNaN(e1rm(50, 20))).toBe(true);
  });
  it("target reps", () => {
    expect(targetReps("8-10")).toBe(8);
    expect(targetReps("AMRAP")).toBeNull();
  });
});
