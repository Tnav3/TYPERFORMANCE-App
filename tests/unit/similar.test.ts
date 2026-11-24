import { describe, it, expect } from "vitest";
import { rankSimilar, type SimilarInput } from "@/lib/programming/similar";

const ex = (id: string, sub: string | null, tags: string[], extra: Partial<SimilarInput> = {}): SimilarInput => ({
  id, name: id, category: "h_press", subcategory: sub, tags, measure: "load", video_url: "https://x", ...extra,
});
describe("similar exercises", () => {
  const bench = ex("Bench", "barbell", ["barbell", "bench", "compound"]);
  const pool = [
    bench,
    ex("DB Bench", "dumbbell", ["dumbbell", "bench"]),
    ex("Floor Press", "barbell", ["barbell"]),
    ex("Push Up", "push_up", ["body weight", "beginner"]),
    ex("Row", "rows", ["barbell"], { category: "h_pull" }),
  ];
  it("prefers the same subcategory and never crosses patterns", () => {
    const r = rankSimilar(bench, pool).map((e) => e.id);
    expect(r[0]).toBe("Floor Press");
    expect(r).not.toContain("Row");
    expect(r).not.toContain("Bench");
  });
  it("no equipment → steers away from the same kit", () => {
    const r = rankSimilar(bench, pool, "equipment").map((e) => e.id);
    expect(r.indexOf("Push Up")).toBeLessThan(r.indexOf("DB Bench"));
  });
});
