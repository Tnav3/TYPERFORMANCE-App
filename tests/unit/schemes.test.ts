import { describe, it, expect } from "vitest";
import { parseScheme, parseSet, schemeLoadOf, schemeRow, schemeText } from "@/lib/programming/schemes";
import { formatSetPlan } from "@/lib/prescription";

describe("loading schemes", () => {
  it("reads sets", () => {
    expect(parseSet("5@75%")).toEqual({ r: "5", p: 75 });
    expect(parseSet("5+ @ 85%")).toEqual({ r: "5+", p: 85 });
    expect(parseSet("4@8.5")).toEqual({ r: "4", e: 8.5 });
    expect(parseSet("8 @ rpe 7")).toEqual({ r: "8", e: 7 });
    expect(parseSet("10@40kg")).toEqual({ r: "10", k: 40 });
    expect(parseSet("8-10")).toEqual({ r: "8-10" });
    expect(parseSet("five")).toBeNull();
  });
  it("reads weeks and prints them back", () => {
    const r = parseScheme("Wk1: 5@75%, 5@75%, 5@75%\n5@77.5%, 4@80%, 4@80%\n5@80%, 4@82.5%, 3@85%");
    expect("weeks" in r && r.weeks.length).toBe(3);
    if ("weeks" in r) {
      expect(schemeText(r.weeks).split("\n")[2]).toBe("5@80%, 4@82.5%, 3@85%");
      expect(schemeLoadOf(r.weeks)).toBe("percent");
    }
    expect(parseScheme("5@75%, nope")).toEqual({ error: expect.stringContaining("Week 1") });
  });
  it("summarises a week into item columns", () => {
    expect(schemeRow([{ r: "5", p: 75 }, { r: "4", p: 80 }, { r: "3", p: 85 }], "percent")).toMatchObject({ sets: 3, reps: "5/4/3", load_type: "percent", percent: 85 });
    expect(formatSetPlan([{ r: "5", p: 75 }, { r: "4", p: 80 }])).toBe("5 @ 75% · 4 @ 80%");
    expect(formatSetPlan([{ r: "8", e: 7 }, { r: "8", e: 7 }])).toBe("2 × 8 @ RPE 7");
  });
});
