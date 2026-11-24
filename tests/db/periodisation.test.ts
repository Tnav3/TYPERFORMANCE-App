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

describe("seasons and phases (034)", () => {
  it("coach plans; the client sees their own season only", async () => {
    await asUser(db, coach, async () => {
      const s = await q(`insert into seasons (athlete_id, name) values ($1, 'Road to title') returning id`, [alice]);
      await q(
        `insert into phases (season_id, name, start_date, end_date, emphasis, intensity_lo, intensity_hi)
         values ($1, 'Max Strength', '2026-12-07', '2027-01-03', '{strength}', 80, 90)`,
        [s.rows[0].id],
      );
    });
    const a = await asUser(db, alice, () => q(`select name from phases`));
    expect(a.rows).toEqual([{ name: "Max Strength" }]);
    const b = await asUser(db, bob, () => q(`select count(*)::int n from phases`));
    expect(b.rows[0].n).toBe(0);
    await expect(
      asUser(db, alice, () => q(`insert into seasons (athlete_id, name) values ($1, 'Mine')`, [alice])),
    ).rejects.toThrow(/row-level/);
  });
  it("rejects backwards dates, bad intensity ranges and unknown emphasis", async () => {
    const s = await asUser(db, coach, () =>
      q(`insert into seasons (athlete_id, name) values ($1, 'S1') returning id`, [alice]),
    );
    const id = s.rows[0].id;
    for (const bad of [
      `('${id}', 'X', '2027-01-10', '2027-01-01', '{}', null, null)`,
      `('${id}', 'X', '2027-01-01', '2027-01-10', '{}', 90, 80)`,
      `('${id}', 'X', '2027-01-01', '2027-01-10', '{yoga}', null, null)`,
    ])
      await expect(
        asUser(db, coach, () =>
          q(`insert into phases (season_id, name, start_date, end_date, emphasis, intensity_lo, intensity_hi) values ${bad}`),
        ),
      ).rejects.toThrow(/check/);
  });
});

describe("readiness and badges (035)", () => {
  it("scores in the database like the app; one per day; own only", async () => {
    const r = await asUser(db, alice, () =>
      q(`insert into readiness (sleep, energy, soreness, stress, motivation, sleep_hours) values (4, 4, 2, 2, 4, 7.5) returning score`),
    );
    expect(r.rows[0].score).toBe(75);
    await expect(
      asUser(db, alice, () => q(`insert into readiness (sleep, energy, soreness, stress, motivation) values (3,3,3,3,3)`)),
    ).rejects.toThrow(/duplicate/);
    const b = await asUser(db, bob, () => q(`select count(*)::int n from readiness`));
    expect(b.rows[0].n).toBe(0);
    await asUser(db, alice, () => q(`insert into badges (key) values ('workouts_1')`));
    await expect(asUser(db, bob, () => q(`insert into badges (athlete_id, key) values ($1, 'workouts_500')`, [alice]))).rejects.toThrow(/row-level/);
  });
});

describe("program instructions (036)", () => {
  it("are copied to the assignment and visible to the client", async () => {
    await asUser(db, coach, async () => {
      const p = await q(`insert into programs (name, weeks, instructions) values ('Prog', 1, 'Warm up with the RAMP routine') returning id`);
      await q(`insert into program_days (program_id, week_no, day_no) values ($1, 1, 1)`, [p.rows[0].id]);
      await q(`select assign_program($1, $2, null, '2026-12-07')`, [p.rows[0].id, alice]);
      await q(`update programs set instructions = 'changed later'`);
    });
    const a = await asUser(db, alice, () => q(`select instructions from assignments`));
    expect(a.rows).toEqual([{ instructions: "Warm up with the RAMP routine" }]);
  });
});

describe("one week at a time (036)", () => {
  it("hides workouts after this week from the client, not the coach", async () => {
    const today = (await q(`select sydney_today()::text d`)).rows[0].d as string;
    await asUser(db, coach, async () => {
      const p = await q(`insert into programs (name, weeks, reveal_weekly) values ('Hidden', 3, true) returning id`);
      for (const w of [1, 2, 3]) await q(`insert into program_days (program_id, week_no, day_no) values ($1, $2, 1)`, [p.rows[0].id, w]);
      await q(`select assign_program($1, $2, null, week_monday($3::date))`, [p.rows[0].id, alice, today]);
    });
    const a = await asUser(db, alice, () => q(`select count(*)::int n from workouts`));
    expect(a.rows[0].n).toBe(1);
    const m = await asUser(db, alice, () => q(`select count(*)::int n from my_workouts(sydney_today() - 30, sydney_today() + 60)`));
    expect(m.rows[0].n).toBe(1);
    const c = await asUser(db, coach, () => q(`select count(*)::int n from workouts`));
    expect(c.rows[0].n).toBe(3);
  });
});

describe("block labels (037)", () => {
  it("travel with copies and assignments", async () => {
    await asUser(db, coach, async () => {
      const p = await q(`insert into programs (name, weeks) values ('Labels', 2) returning id`);
      const d = await q(`insert into program_days (program_id, week_no, day_no) values ($1, 1, 1) returning id`, [p.rows[0].id]);
      const ex = (await q(`select id from exercises limit 1`)).rows[0].id;
      await q(`insert into program_items (day_id, exercise_id, block, block_title) values ($1, $2, 'A', 'Power')`, [d.rows[0].id, ex]);
      await q(`select copy_program_week($1, 1, 2)`, [p.rows[0].id]);
      await q(`select assign_program($1, $2, null, '2026-12-07')`, [p.rows[0].id, alice]);
    });
    const r = await q(`select count(*)::int n from workout_items where block_title = 'Power'`);
    expect(r.rows[0].n).toBe(2);
  });
});
