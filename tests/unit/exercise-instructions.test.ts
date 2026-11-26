import { describe, expect, it } from "vitest";
import { CUES_MAX, hasSteps, mergeCues, stepsFor } from "@/lib/exercise-instructions";
import data from "@/lib/exercise-instructions.json";

describe("exercise instructions", () => {
  it("spots numbered steps", () => {
    expect(hasSteps("1. Stand tall")).toBe(true);
    expect(hasSteps("Set up\n1) Grip")).toBe(true);
    expect(hasSteps("Keep a flat back")).toBe(false);
    expect(hasSteps(null)).toBe(false);
  });
  it("keeps the coach's notes under the steps", () => {
    expect(mergeCues("Steps\n1. A", "  Max effort ")).toBe("Steps\n1. A\n\nCoach notes\nMax effort");
    expect(mergeCues("Steps\n1. A", "")).toBe("Steps\n1. A");
    expect(mergeCues("x".repeat(1990), "a long note")).toBeNull();
  });
  it("looks up by name, ignoring case", () => {
    expect(stepsFor("  GLUTE BRIDGE ")).toMatch(/^Steps\n1\. /);
    expect(stepsFor("Not a real exercise")).toBeNull();
  });
  it("every entry is numbered steps, fits, and has no em dashes", () => {
    for (const [k, v] of Object.entries(data as Record<string, string>)) {
      expect(k).toBe(k.toLowerCase());
      expect(hasSteps(v)).toBe(true);
      expect(v.length).toBeLessThan(CUES_MAX - 200);
      expect(v).not.toMatch(/—/);
    }
  });
});

describe("planCues", () => {
  it("leaves the coach's own text alone unless a tip is missing", async () => {
    const { planCues } = await import("@/lib/exercise-instructions");
    expect(planCues("Not a real exercise", "1. Do it")).toBeNull();
    expect(planCues("Glute Bridge", "Steps\n1. Something the coach rewrote")).toBeNull();
    expect(planCues("Glute Bridge", null)).toMatch(/^Steps\n1\. /);
  });
});
