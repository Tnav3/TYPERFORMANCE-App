import { describe, it, expect } from "vitest";
import { FAQ } from "@/lib/faq";

describe("FAQ content", () => {
  it("three sections, red flags on injuries, unique questions", () => {
    expect(FAQ.map((s) => s.id)).toEqual(["strength", "injuries", "nutrition"]);
    expect(FAQ[1].alert?.points.length).toBeGreaterThanOrEqual(7);
    const qs = FAQ.flatMap((s) => s.items.map((i) => i.q));
    expect(new Set(qs).size).toBe(qs.length);
  });
  it("swap tables have three filled columns and numeric amounts", () => {
    const t = FAQ[2].items.flatMap((i) => i.tables ?? []);
    expect(t).toHaveLength(2);
    for (const tb of t) for (const r of tb.rows) {
      expect(r.every((c) => c.trim().length > 0)).toBe(true);
      expect(Number(r[2])).toBeGreaterThan(0);
    }
  });
  it("pain rule matches between strength and injuries (3/10)", () => {
    const all = FAQ.flatMap((s) => s.items.flatMap((i) => i.a)).join(" ");
    expect(all).toContain("3/10 or less");
    expect(all).toContain("up to 3/10");
    expect(all).not.toMatch(/5\/10/);
  });
});
