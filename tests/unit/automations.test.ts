import { describe, it, expect } from "vitest";
import { clampThreshold, summary, TEMPLATES, TRIGGERS } from "@/lib/automations";

describe("automation labels", () => {
  it("reads like a sentence", () => {
    expect(summary("missed_sessions", 2, "client")).toBe("When a client misses 2 sessions in a week → send them a message from you");
    expect(summary("program_ending", 1, "coach")).toBe("When a client has 1 day or less left on their program → tell you");
  });
  it("keeps thresholds in range", () => {
    expect(clampThreshold("missed_sessions", 40)).toBe(7);
    expect(clampThreshold("low_readiness", NaN)).toBe(50);
  });
  it("templates fit their trigger's range", () => {
    for (const t of TEMPLATES) expect(clampThreshold(t.trigger, t.threshold)).toBe(t.threshold);
    expect(Object.keys(TRIGGERS)).toHaveLength(5);
  });
});
