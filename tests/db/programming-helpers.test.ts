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
  await q(`update profiles set status = 'active' where id = $1`, [alice]);
});

describe("programming helpers (076)", () => {
  it("flags and schemes are coach-only; schemes are seeded", async () => {
    await asUser(db, coach, () => q(`insert into client_flags (athlete_id, kind, title) values ($1, 'injury', 'Left shoulder')`, [alice]));
    expect((await asUser(db, alice, () => q(`select count(*)::int n from client_flags`))).rows[0].n).toBe(0);
    expect((await asUser(db, alice, () => q(`select count(*)::int n from loading_schemes`))).rows[0].n).toBe(0);
    expect((await asUser(db, coach, () => q(`select count(*)::int n from loading_schemes`))).rows[0].n).toBeGreaterThanOrEqual(5);
  });
  it("set_plan copies through assign, duplicate and copy-week", async () => {
    await asUser(db, coach, async () => {
      const ex = await q(`select id from exercises limit 1`);
      const p = await q(`insert into programs (name, weeks) values ('Block', 2) returning id`);
      const day = await q(`insert into program_days (program_id, week_no, day_no) values ($1, 1, 1) returning id`, [p.rows[0].id]);
      await q(`insert into program_items (day_id, position, kind, exercise_id, block, slot, sets, reps, set_plan)
               values ($1, 1, 'exercise', $2, 'A', 1, 3, '5/4/3', '[{"r":"5","p":75},{"r":"4","p":80},{"r":"3","p":85}]')`, [day.rows[0].id, ex.rows[0].id]);
      await q(`select copy_program_week($1, 1, 2)`, [p.rows[0].id]);
      await q(`select duplicate_program($1, 'Copy')`, [p.rows[0].id]);
      await q(`select assign_program($1, $2, null, '2026-11-02')`, [p.rows[0].id, alice]);
    });
    expect((await q(`select count(*)::int n from program_items where set_plan is not null`)).rows[0].n).toBe(4);
    const w = await q(`select set_plan from workout_items wi join workouts w on w.id = wi.workout_id where w.athlete_id = $1 limit 1`, [alice]);
    expect((w.rows[0].set_plan as unknown[]).length).toBe(3);
  });
});
