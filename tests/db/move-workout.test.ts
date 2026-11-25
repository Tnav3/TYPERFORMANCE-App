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

describe("clients move workouts (068)", () => {
  it("moves their own workout and tells the coach", async () => {
    const w = (await q(`insert into workouts (athlete_id, workout_date, title, created_by) values ($1, sydney_today(), 'Legs', $2) returning id`, [alice, coach])).rows[0].id;
    await asUser(db, alice, () => q(`select move_my_workout($1, sydney_today() + 1)`, [w]));
    expect((await q(`select workout_date = sydney_today() + 1 ok from workouts where id = $1`, [w])).rows[0].ok).toBe(true);
    expect((await q(`select count(*)::int n from notifications where user_id = $1 and title like 'Alice moved%'`, [coach])).rows[0].n).toBe(1);
  });
  it("a group workout becomes their own copy; others can't move it; limits apply", async () => {
    const g = (await q(`insert into groups (name) values ('Squad') returning id`)).rows[0].id;
    await q(`insert into group_members (group_id, athlete_id) values ($1, $2)`, [g, alice]);
    const w = (await q(`insert into workouts (group_id, workout_date, title) values ($1, sydney_today(), 'Team') returning id`, [g])).rows[0].id;
    const copy = (await asUser(db, alice, () => q(`select move_my_workout($1, sydney_today() + 2) id`, [w]))).rows[0].id;
    expect(copy).not.toBe(w);
    expect((await q(`select workout_date = sydney_today() ok from workouts where id = $1`, [w])).rows[0].ok).toBe(true);
    await expect(asUser(db, bob, () => q(`select move_my_workout($1, sydney_today() + 1)`, [w]))).rejects.toThrow(/not found/);
    await expect(asUser(db, alice, () => q(`select move_my_workout($1, sydney_today() + 60)`, [copy]))).rejects.toThrow(/4 weeks/);
  });
});
