import { describe, it, expect } from "vitest";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

describe("food products (094)", () => {
  it("seeds the AU product list; coach only", async () => {
    const db = await freshDb();
    const coach = await signUp(db, "coach@typ.test", "Coach");
    const alice = await signUp(db, "alice@typ.test", "Alice");
    await makeCoach(db, "coach@typ.test");
    const n = await asUser(db, coach, () => db.query<{ n: number }>(`select count(*)::int n from food_products`));
    expect(n.rows[0].n).toBe(219);
    const a = await asUser(db, alice, () => db.query<{ n: number }>(`select count(*)::int n from food_products`));
    expect(a.rows[0].n).toBe(0);
    const r = await db.query<{ kcal: string }>(`select kcal from food_products where brand = 'SunRice' and name like 'White Medium Grain%'`);
    expect(Number(r.rows[0].kcal)).toBe(192);
  });
});
