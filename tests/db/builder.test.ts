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

describe("builder speed-ups (046–047)", () => {
  it("speed shows in m/s by default and exercise defaults are validated", async () => {
    const r = await asUser(db, coach, () =>
      q(`insert into exercises (name, category, default_sets, default_reps, default_load_type, default_load_value, default_rest_sec)
         values ('Test Nordic', 'accessory', 3, '5', 'none', null, 90) returning speed_unit`),
    );
    expect(r.rows[0].speed_unit).toBe("ms");
    await expect(
      asUser(db, coach, () => q(`insert into exercises (name, category, default_sets) values ('Bad', 'accessory', 40)`)),
    ).rejects.toThrow(/check/);
  });

  it("saved blocks are coach-only", async () => {
    await asUser(db, coach, () => q(`insert into saved_blocks (name, items) values ('Neck', '[{"kind":"text","title":"Neck"}]')`));
    const a = await asUser(db, alice, () => q(`select count(*)::int n from saved_blocks`));
    expect(a.rows[0].n).toBe(0);
    await expect(asUser(db, alice, () => q(`insert into saved_blocks (name, items) values ('Mine', '[{}]')`))).rejects.toThrow(/row-level/);
    await expect(asUser(db, coach, () => q(`insert into saved_blocks (name, items) values ('Empty', '[]')`))).rejects.toThrow(/check/);
  });

  it("shift_assignment moves only unlogged workouts from the given date", async () => {
    const ids = await asUser(db, coach, async () => {
      const p = await q(`insert into programs (name, weeks) values ('Block', 1) returning id`);
      const pid = p.rows[0].id;
      for (const d of [1, 3, 5]) {
        const day = await q(`insert into program_days (program_id, week_no, day_no) values ($1, 1, $2) returning id`, [pid, d]);
        await q(`insert into program_items (day_id, position, kind, title, block, slot) values ($1, 1, 'text', 'Go', 'A', 1)`, [day.rows[0].id]);
      }
      await q(`select assign_program($1, $2, null, '2026-11-02')`, [pid, alice]);
      const a = await q(`select id from assignments where athlete_id = $1`, [alice]);
      return { a: a.rows[0].id as string };
    });
    // Alice logs Monday's workout
    const mon = await q(`select id from workouts where athlete_id = $1 and workout_date = '2026-11-02'`, [alice]);
    await asUser(db, alice, () => q(`insert into workout_logs (workout_id, workout_date) values ($1, '2026-11-02')`, [mon.rows[0].id]));
    const n = await asUser(db, coach, () => q(`select shift_assignment($1, 7, '2026-11-01') n`, [ids.a]));
    expect(n.rows[0].n).toBe(2);
    const dates = await q(`select workout_date::text d from workouts where athlete_id = $1 order by 1`, [alice]);
    expect(dates.rows.map((r) => r.d)).toEqual(["2026-11-02", "2026-11-11", "2026-11-13"]);
    await expect(asUser(db, alice, () => q(`select shift_assignment($1, 7, '2026-11-01')`, [ids.a]))).rejects.toThrow(/Coach only/);
  });
});
