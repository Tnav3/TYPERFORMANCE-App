import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let alice: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);

beforeEach(async () => {
  db = await freshDb();
  await signUp(db, "coach@typ.test", "Coach");
  alice = await signUp(db, "alice@typ.test", "Alice");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id = $1`, [alice]);
});

describe("exercise swaps (057)", () => {
  it("logged sets follow the swapped exercise", async () => {
    const [sq, lp] = (await q(`select id from exercises where category = 'knee' order by name limit 2`)).rows.map((r) => r.id as string);
    const w = (await q(`insert into workouts (athlete_id, workout_date, title) values ($1, sydney_today(), 'Legs') returning id`, [alice])).rows[0].id;
    const item = (await q(`insert into workout_items (workout_id, kind, exercise_id, position, sets, reps) values ($1, 'exercise', $2, 1, 3, '5') returning id`, [w, sq])).rows[0].id;
    await asUser(db, alice, async () => {
      const log = (await q(`insert into workout_logs (workout_id, athlete_id, workout_date) values ($1, $2, sydney_today()) returning id`, [w, alice])).rows[0].id;
      await q(`insert into set_logs (log_id, item_id, set_no, reps, load_kg) values ($1, $2, 1, 5, 100)`, [log, item]);
      expect((await q(`select exercise_id from set_logs`)).rows[0].exercise_id).toBe(sq);
      await q(`insert into item_logs (log_id, item_id, swap_exercise_id, swap_reason) values ($1, $2, $3, 'equipment')`, [log, item, lp]);
      await q(`insert into set_logs (log_id, item_id, set_no, reps, load_kg) values ($1, $2, 2, 5, 100)`, [log, item]);
      expect((await q(`select distinct exercise_id from set_logs`)).rows).toEqual([{ exercise_id: lp }]);
      await q(`update item_logs set swap_exercise_id = null, swap_reason = null`);
      expect((await q(`select distinct exercise_id from set_logs`)).rows).toEqual([{ exercise_id: sq }]);
    });
  });
});

describe("pain swap alert (058)", () => {
  it("notifies the coach", async () => {
    const [sq, lp] = (await q(`select id from exercises where category = 'knee' order by name limit 2`)).rows.map((r) => r.id as string);
    const w = (await q(`insert into workouts (athlete_id, workout_date, title) values ($1, sydney_today(), 'Legs') returning id`, [alice])).rows[0].id;
    const item = (await q(`insert into workout_items (workout_id, kind, exercise_id, position, sets, reps) values ($1, 'exercise', $2, 1, 3, '5') returning id`, [w, sq])).rows[0].id;
    await asUser(db, alice, async () => {
      const log = (await q(`insert into workout_logs (workout_id, athlete_id, workout_date) values ($1, $2, sydney_today()) returning id`, [w, alice])).rows[0].id;
      await q(`insert into item_logs (log_id, item_id, swap_exercise_id, swap_reason, swap_note) values ($1, $2, $3, 'pain', 'left knee')`, [log, item, lp]);
    });
    const n = await q(`select title, body from notifications where kind = 'reminder'`);
    expect(n.rows).toHaveLength(1);
    expect(String(n.rows[0].body)).toMatch(/^Alice swapped .*: left knee$/);
  });
});
