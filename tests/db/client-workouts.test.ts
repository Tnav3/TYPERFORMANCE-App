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

describe("client-made workouts (060)", () => {
  it("a client adds, fills and logs their own workout; the coach is told", async () => {
    const ex = (await q(`select id from exercises limit 1`)).rows[0].id;
    await asUser(db, alice, async () => {
      const w = (await q(`insert into workouts (athlete_id, workout_date, title) values ($1, sydney_today(), 'Extra conditioning') returning id`, [alice])).rows[0].id;
      await q(`insert into workout_items (workout_id, kind, exercise_id, position, sets, reps) values ($1, 'exercise', $2, 1, 3, '10')`, [w, ex]);
      expect((await q(`select count(*)::int n from workout_items`)).rows[0].n).toBe(1);
    });
    const n = await q(`select user_id, title from notifications where kind = 'workout'`);
    expect(n.rows).toEqual([{ user_id: coach, title: "Alice added a workout" }]);
  });
  it("can't touch coach workouts, other clients, or far dates", async () => {
    const cw = (await q(`insert into workouts (athlete_id, workout_date, title, created_by) values ($1, sydney_today(), 'Coach', $2) returning id`, [alice, coach])).rows[0].id;
    await asUser(db, alice, async () => {
      await q(`update workouts set title = 'Hacked' where id = $1`, [cw]);
      await expect(q(`insert into workouts (athlete_id, workout_date, title) values ($1, sydney_today(), 'X')`, [bob])).rejects.toThrow(/row-level/);
      await expect(q(`insert into workouts (athlete_id, workout_date, title) values ($1, sydney_today() + 10, 'X')`, [alice])).rejects.toThrow(/row-level/);
      await expect(q(`insert into workout_items (workout_id, kind, title) values ($1, 'text', 'x')`, [cw])).rejects.toThrow(/row-level/);
    });
    expect((await q(`select title from workouts where id = $1`, [cw])).rows[0].title).toBe("Coach");
  });
});
