import { describe, expect, it } from "vitest";
import { guideSteps } from "@/lib/logger-guide";

describe("guideSteps", () => {
  it("keeps only steps whose control is on screen", () => {
    const on = new Set(["set", "tick", "swap", "next", "view"]);
    expect(guideSteps((t) => on.has(t)).map((s) => s.target)).toEqual(["set", "tick", "swap", "next"]);
  });
  it("falls back to the view toggle when there's no Next button", () => {
    const on = new Set(["set", "tick", "view"]);
    expect(guideSteps((t) => on.has(t)).map((s) => s.target)).toEqual(["set", "tick", "view"]);
  });
});
