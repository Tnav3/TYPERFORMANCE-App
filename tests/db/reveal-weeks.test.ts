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
  await q(`update profiles set status = 'active', feat_program = true where id = $1`, [alice]);
});

describe("reveal weeks (103)", () => {
  it("hides workouts past the chosen number of weeks", async () => {
    const a = (await q(`insert into assignments (program_name, athlete_id, start_date) values ('Camp', $1, week_monday(sydney_today())) returning id`, [alice])).rows[0].id;
    for (const wk of [0, 1, 2, 3]) {
      await q(`insert into workouts (athlete_id, assignment_id, workout_date, title, created_by) values ($1, $2, week_monday(sydney_today()) + $3::int * 7 + 1, 'W' || $3::text, $4)`, [alice, a, wk, coach]);
    }
    const seen = async () => (await asUser(db, alice, () => q(`select count(*)::int n from workouts`))).rows[0].n;
    expect(await seen()).toBe(4);
    await q(`update assignments set reveal_weeks = 2 where id = $1`, [a]);
    expect(await seen()).toBe(2);
    await q(`update assignments set reveal_weeks = null, reveal_weekly = true where id = $1`, [a]);
    expect(await seen()).toBe(1);
  });
});
