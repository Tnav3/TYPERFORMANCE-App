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

describe("coach logs for a client (052)", () => {
  it("coach can create the log and sets; other clients still can't", async () => {
    const { w, item } = await asUser(db, coach, async () => {
      const w = (await q(`insert into workouts (athlete_id, workout_date, title) values ($1, current_date, 'Lift') returning id`, [alice])).rows[0].id as string;
      const item = (await q(`insert into workout_items (workout_id, position, kind, title, block, slot) values ($1, 1, 'text', 'Go', 'A', 1) returning id`, [w])).rows[0].id as string;
      return { w, item };
    });
    const log = await asUser(db, coach, () => q(`insert into workout_logs (workout_id, athlete_id) values ($1, $2) returning id, logged_by`, [w, alice]));
    expect(log.rows[0].logged_by).toBe(coach);
    const logId = log.rows[0].id;
    await asUser(db, coach, () => q(`insert into set_logs (log_id, item_id, set_no, done, reps) values ($1, $2, 1, true, 5)`, [logId, item]));
    expect((await asUser(db, alice, () => q(`select count(*)::int n from set_logs`))).rows[0].n).toBe(1);
    await expect(asUser(db, bob, () => q(`insert into set_logs (log_id, item_id, set_no, done) values ($1, $2, 2, true)`, [logId, item]))).rejects.toThrow();
    await expect(asUser(db, bob, () => q(`insert into workout_logs (workout_id, athlete_id) values ($1, $2)`, [w, alice]))).rejects.toThrow(/own workouts|row-level/);
  });
});
