import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);
beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Coach");
  alice = await signUp(db, "alice@typ.test", "Alice");
  await makeCoach(db, "coach@typ.test");
});

describe("editable categories (065)", () => {
  it("coach adds a subcategory and uses it; clients can't edit the list", async () => {
    await asUser(db, coach, async () => {
      await q(`insert into exercise_subcategories (category, key, label) values ('cond_mob', 'flexibility', 'Flexibility')`);
      await q(`update exercises set subcategory = 'flexibility' where id = (select id from exercises where category = 'cond_mob' limit 1)`);
    });
    expect((await q(`select count(*)::int n from exercises where subcategory = 'flexibility'`)).rows[0].n).toBe(1);
    await expect(asUser(db, alice, () => q(`insert into exercise_categories (key, label) values ('x_cat', 'X')`))).rejects.toThrow(/row-level/);
  });
  it("a subcategory must belong to the exercise's category; in-use categories can't vanish", async () => {
    await expect(q(`update exercises set subcategory = 'rows' where category = 'knee'`)).rejects.toThrow(/foreign key/);
    await expect(q(`delete from exercise_categories where key = 'knee'`)).rejects.toThrow(/foreign key/);
  });
});
