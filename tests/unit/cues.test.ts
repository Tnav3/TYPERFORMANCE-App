import { describe, expect, it } from "vitest";
import { parseCues } from "@/lib/cues";

describe("parseCues", () => {
  it("splits steps, tip and coach notes", () => {
    const s = parseCues("Steps\n1. Stand tall\n2. Squat down\n\nTip\nKnees out.\n\nCoach notes\nMAX EFFORT");
    expect(s.map((x) => x.kind)).toEqual(["steps", "tip", "notes"]);
    expect(s[0].items).toEqual(["Stand tall", "Squat down"]);
    expect(s[0].numbered).toBe(true);
    expect(s[2].items).toEqual(["MAX EFFORT"]);
  });
  it("handles Trainerize-style text with no headings", () => {
    const s = parseCues("1. Grip the bar\n\n2. Pull\n\nTips\nMake sure to brace\n- Breathe out");
    expect(s[0]).toMatchObject({ kind: "steps", items: ["Grip the bar", "Pull"] });
    expect(s[1]).toMatchObject({ kind: "tip", items: ["Make sure to brace", "Breathe out"] });
  });
  it("plain notes stay as text", () => {
    expect(parseCues("Keep a flat back")).toEqual([{ title: null, kind: "text", items: ["Keep a flat back"], numbered: false }]);
    expect(parseCues("")).toEqual([]);
  });
});
