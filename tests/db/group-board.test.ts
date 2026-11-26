import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string, carl: string, g: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);
beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Coach");
  alice = await signUp(db, "alice@typ.test", "Alice Smith");
  bob = await signUp(db, "bob@typ.test", "Bob Jones");
  carl = await signUp(db, "carl@typ.test", "Carl");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active', feat_program = true where id in ($1, $2, $3)`, [alice, bob, carl]);
  g = (await q(`insert into groups (name) values ('Tues 6pm') returning id`)).rows[0].id as string;
  await q(`insert into group_members (group_id, athlete_id) values ($1, $2), ($1, $3)`, [g, alice, bob]);
});

describe("group board (105)", () => {
  it("members see first names and effort only when switched on; outsiders never", async () => {
    const w = (await q(`insert into workouts (athlete_id, workout_date, title, created_by) values ($1, sydney_today(), 'S', $2) returning id`, [alice, coach])).rows[0].id;
    await asUser(db, alice, () => q(`insert into workout_logs (workout_id, athlete_id, workout_date, completed_at, logged_by, session_rpe, duration_min) values ($1, $2, sydney_today(), now(), $2, 6, 45)`, [w, alice]));
    const board = (who: string) => asUser(db, who, () => q(`select name, sessions_week, is_me from group_board($1)`, [g]));
    expect((await board(alice)).rows).toHaveLength(0);
    await q(`update groups set leaderboard = true where id = $1`, [g]);
    const rows = (await board(alice)).rows;
    expect(rows.map((r) => [r.name, r.sessions_week, r.is_me])).toEqual([["Alice", 1, true], ["Bob", 0, false]]);
    expect((await board(carl)).rows).toHaveLength(0);
    expect((await board(coach)).rows).toHaveLength(2);
  });
});
