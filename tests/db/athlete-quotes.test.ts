import { describe, it, expect } from "vitest";
import { freshDb } from "./harness";

describe("athlete quotes (078)", () => {
  it("replaces placeholders with sourced quotes", async () => {
    const db = await freshDb();
    const r = await db.query<{ author: string; source: string | null }>(`select author, source from quotes`);
    expect(r.rows.some((q) => q.author === "TYPERFORMANCE")).toBe(false);
    expect(r.rows.length).toBe(7);
    expect(r.rows.every((q) => !!q.source)).toBe(true);
  });
});
