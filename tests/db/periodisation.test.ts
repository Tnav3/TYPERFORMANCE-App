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

describe("substitution (039)", () => {
  it("swaps an exercise across a program, keeping the prescription; future unlogged workouts only for assignments", async () => {
    const ids = async (n: string) => (await q(`select id from exercises where name = $1`, [n])).rows[0].id as string;
    const squat = await ids("Back Squat");
    const front = await ids("Front Squat");
    const today = (await q(`select sydney_today()::text d`)).rows[0].d as string;
    const pid = await asUser(db, coach, async () => {
      const p = await q(`insert into programs (name, weeks) values ('Swap me', 2) returning id`);
      for (const w of [1, 2]) {
        const d = await q(`insert into program_days (program_id, week_no, day_no) values ($1, $2, 1) returning id`, [p.rows[0].id, w]);
        await q(`insert into program_items (day_id, exercise_id, sets, reps, load_type, percent) values ($1, $2, 4, '5', 'percent', $3)`, [d.rows[0].id, squat, 75 + w * 5]);
      }
      return p.rows[0].id as string;
    });
    const n = await asUser(db, coach, () => q(`select substitute_exercise('program', $1, $2, $3) n`, [pid, squat, front]));
    expect(n.rows[0].n).toBe(2);
    const r = await q(`select i.percent::float p from program_items i join program_days d on d.id = i.day_id where d.program_id = $1 and i.exercise_id = $2 order by p`, [pid, front]);
    expect(r.rows).toEqual([{ p: 80 }, { p: 85 }]);
    // Assignment scope leaves logged workouts alone
    const a = await asUser(db, coach, () => q(`select assign_program($1, $2, null, $3::date) id`, [pid, alice, today]));
    const first = await q(`select id from workouts where workout_date = $1::date and athlete_id = $2`, [today, alice]);
    await asUser(db, alice, () => q(`insert into workout_logs (workout_id) values ($1)`, [first.rows[0].id]));
    const m = await asUser(db, coach, () => q(`select substitute_exercise('assignment', $1, $2, $3) n`, [a.rows[0].id, front, squat]));
    expect(m.rows[0].n).toBe(1);
    await expect(asUser(db, alice, () => q(`select substitute_exercise('program', $1, $2, $3)`, [pid, front, squat]))).rejects.toThrow(/Coach only/);
  });
});

describe("VBT and per-line metrics (042)", () => {
  it("velocity targets and line fields travel to clients; duplicate keeps instructions", async () => {
    await asUser(db, coach, async () => {
      const p = await q(`insert into programs (name, weeks, instructions, reveal_weekly) values ('VBT block', 1, 'Use the bar sensor', false) returning id`);
      const d = await q(`insert into program_days (program_id, week_no, day_no) values ($1, 1, 1) returning id`, [p.rows[0].id]);
      const ex = (await q(`select id from exercises where name = 'Back Squat'`)).rows[0].id;
      await q(`insert into program_items (day_id, exercise_id, sets, reps, load_type, percent, velocity, fields) values ($1, $2, 4, '3', 'percent', 80, 0.7, '{reps,weight,velocity}')`, [d.rows[0].id, ex]);
      await q(`insert into program_items (day_id, exercise_id, sets, reps, load_type, velocity) values ($1, $2, 3, '3', 'velocity', 0.9)`, [d.rows[0].id, ex]);
      const copy = await q(`select duplicate_program($1, 'VBT copy') id`, [p.rows[0].id]);
      const c = await q(`select instructions from programs where id = $1`, [copy.rows[0].id]);
      expect(c.rows[0].instructions).toBe("Use the bar sensor");
      await q(`select assign_program($1, $2, null, '2026-12-07')`, [p.rows[0].id, alice]);
    });
    const r = await q(`select velocity::float v, fields from workout_items order by velocity`);
    expect(r.rows).toEqual([{ v: 0.7, fields: ["reps", "weight", "velocity"] }, { v: 0.9, fields: null }]);
    await expect(
      asUser(db, coach, async () => {
        const d = (await q(`select id from program_days limit 1`)).rows[0].id;
        const ex = (await q(`select id from exercises limit 1`)).rows[0].id;
        await q(`insert into program_items (day_id, exercise_id, load_type) values ($1, $2, 'velocity')`, [d, ex]);
      }),
    ).rejects.toThrow(/velocity_needed|check/);
  });
});
