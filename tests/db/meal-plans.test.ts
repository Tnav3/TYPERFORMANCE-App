import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);
beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Coach");
  alice = await signUp(db, "alice@typ.test", "Alice");
  bob = await signUp(db, "bob@typ.test", "Bob");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id in ($1, $2)`, [alice, bob]);
});

describe("meal plans (072)", () => {
  it("clients see only their own published plans; library is coach-only", async () => {
    await asUser(db, coach, async () => {
      await q(`insert into meal_library (name, slot, kcal, protein_g, carbs_g, fat_g) values ('3 scrambled eggs with avocado', 'breakfast', 420, 22, 6, 34)`);
      await q(`insert into meal_plans (athlete_id, title, status, snapshot, published_at) values ($1, 'Week 1', 'published', '{"x":1}', now()), ($1, 'Draft', 'draft', null, null)`, [alice]);
    });
    expect((await asUser(db, alice, () => q(`select title from meal_plans`))).rows).toEqual([{ title: "Week 1" }]);
    expect((await asUser(db, bob, () => q(`select count(*)::int n from meal_plans`))).rows[0].n).toBe(0);
    expect((await asUser(db, alice, () => q(`select count(*)::int n from meal_library`))).rows[0].n).toBe(0);
  });
});

describe("meal plan publish notification", () => {
  it("notifies the client once on publish", async () => {
    await asUser(db, coach, async () => {
      const { rows } = await q(`insert into meal_plans (athlete_id, title) values ($1, 'Fat loss') returning id`, [alice]);
      await q(`update meal_plans set status = 'published', snapshot = '{}' where id = $1`, [rows[0].id]);
      await q(`update meal_plans set title = 'Fat loss v2' where id = $1`, [rows[0].id]);
    });
    const n = await q(`select title, url from notifications where user_id = $1`, [alice]);
    expect(n.rows).toEqual([{ title: "Your meal plan is ready", url: "/meal-plan" }]);
  });
});
