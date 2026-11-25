import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string, carl: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);
beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Coach");
  alice = await signUp(db, "alice@typ.test", "Alice Smith");
  bob = await signUp(db, "bob@typ.test", "Bob Jones");
  carl = await signUp(db, "carl@typ.test", "Carl");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id in ($1, $2, $3)`, [alice, bob, carl]);
});

describe("group activity (077)", () => {
  it("only members of groups with the feed on see completions", async () => {
    const g = await asUser(db, coach, async () => {
      const g = await q(`insert into groups (name) values ('Fight team') returning id`);
      await q(`insert into group_members (group_id, athlete_id) values ($1, $2), ($1, $3)`, [g.rows[0].id, alice, bob]);
      const w = await q(`insert into workouts (athlete_id, workout_date, title) values ($1, current_date, 'Strength A') returning id`, [bob]);
      return { g: g.rows[0].id as string, w: w.rows[0].id as string };
    });
    await asUser(db, bob, () => q(`insert into workout_logs (workout_id, workout_date, completed_at, session_rpe, duration_min) values ($1, current_date, now(), 7, 45)`, [g.w]));
    expect((await asUser(db, alice, () => q(`select * from group_activity()`))).rows.length).toBe(0);
    await asUser(db, coach, () => q(`update groups set show_activity = true where id = $1`, [g.g]));
    const r = await asUser(db, alice, () => q(`select first_name, workout_title from group_activity()`));
    expect(r.rows).toEqual([{ first_name: "Bob", workout_title: "Strength A" }]);
    expect((await asUser(db, carl, () => q(`select * from group_activity()`))).rows.length).toBe(0);
  });
});
