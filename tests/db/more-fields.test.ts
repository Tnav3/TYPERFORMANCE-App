import { describe, it, expect } from "vitest";
import { freshDb } from "./harness";
import { fromCanonical, toCanonical, DEFAULT_UNITS } from "@/lib/programming/fields";

describe("more fields, yards, smart defaults (081)", () => {
  it("allows up to 8 fields and yards", async () => {
    const db = await freshDb();
    const ex = await db.query<{ id: string }>(`select id from exercises limit 1`);
    const id = ex.rows[0].id;
    await db.query(`update exercises set fields = array['reps','weight','time','distance','speed','watts','heart_rate','rpe'] where id = $1`, [id]);
    await expect(db.query(`update exercises set fields = array['reps','weight','time','distance','speed','watts','heart_rate','rpe','height'] where id = $1`, [id])).rejects.toThrow();
    await db.query(`update exercises set distance_unit = 'yd' where id = $1`, [id]);
  });

  it("new Keiser and band exercises get default fields; picked fields are kept", async () => {
    const db = await freshDb();
    const row = (name: string, fields: string | null = null) =>
      db.query<{ fields: string[] | null }>(
        `insert into exercises (name, category, measure, fields) values ($1, 'knee', 'load', ${fields ?? "null"}) returning fields`,
        [name],
      ).then((r) => r.rows[0].fields);
    expect(await row("Keiser Seated Chest Press Test")).toEqual(["reps", "resistance", "watts"]);
    expect(await row("Mini Band Lateral Walk Test")).toEqual(["reps", "band"]);
    expect(await row("Dumbbell Band Thing Test")).toBeNull();
    expect(await row("Keiser Squat Test", "array['reps','watts']")).toEqual(["reps", "watts"]);
  });

  it("converts yards", () => {
    const u = { ...DEFAULT_UNITS, distance_unit: "yd" as const };
    expect(toCanonical("distance", "100", u)).toBe(91.4);
    expect(fromCanonical("distance", 91.44, u)).toBe("100");
  });
});
