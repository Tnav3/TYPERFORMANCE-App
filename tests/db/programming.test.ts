import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string, pending: string;
const q = (sql: string, params: unknown[] = []) =>
  db.query<Record<string, unknown>>(sql, params);
const today = async () =>
  String((await q(`select sydney_today()::text d`)).rows[0].d);

async function exerciseId(name: string) {
  const r = await q(`select id from exercises where name = $1`, [name]);
  return r.rows[0].id as string;
}

/** A 2-week program: W1D1 back squat 4x5 @ 80% + a text block, W1D3 bench. */
async function makeProgram() {
  return asUser(db, coach, async () => {
    const p = await q(
      `insert into programs (name, weeks) values ('Fight camp', 2) returning id`,
    );
    const pid = p.rows[0].id as string;
    const d1 = await q(
      `insert into program_days (program_id, week_no, day_no, title) values ($1, 1, 1, 'Lower') returning id`,
      [pid],
    );
    const d3 = await q(
      `insert into program_days (program_id, week_no, day_no) values ($1, 1, 3) returning id`,
      [pid],
    );
    await q(
      `insert into program_items (day_id, position, exercise_id, sets, reps, load_type, percent)
       values ($1, 1, $2, 4, '5', 'percent', 80)`,
      [d1.rows[0].id, await exerciseId("Back Squat")],
    );
    await q(
      `insert into program_items (day_id, position, kind, title, notes) values ($1, 2, 'text', 'ESD', '10 x 30s bike')`,
      [d1.rows[0].id],
    );
    await q(
      `insert into program_items (day_id, position, exercise_id, sets, reps, load_type, rpe)
       values ($1, 1, $2, 3, '8', 'rpe', 7)`,
      [d3.rows[0].id, await exerciseId("Bench Press")],
    );
    return pid;
  });
}

beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Tyrell");
  alice = await signUp(db, "alice@typ.test", "Alice");
  bob = await signUp(db, "bob@typ.test", "Bob");
  pending = await signUp(db, "pending@typ.test", "Pending");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id in ($1, $2)`, [
    alice,
    bob,
  ]);
});

describe("exercise library (029)", () => {
  it("is seeded with calculator lifts (linked) and accessories", async () => {
    const r = await q(
      `select count(*)::int n, count(lift_key)::int linked from exercises`,
    );
    expect(r.rows[0].n).toBeGreaterThan(60);
    expect(r.rows[0].linked).toBeGreaterThan(20);
  });
  it("active clients can read, only the coach can add", async () => {
    const read = await asUser(db, alice, () =>
      q(`select count(*)::int n from exercises`),
    );
    expect(read.rows[0].n).toBeGreaterThan(0);
    const pend = await asUser(db, pending, () =>
      q(`select count(*)::int n from exercises`),
    );
    expect(pend.rows[0].n).toBe(0);
    await expect(
      asUser(db, alice, () =>
        q(`insert into exercises (name, category) values ('Hack', 'core')`),
      ),
    ).rejects.toThrow(/row-level security/);
    await asUser(db, coach, () =>
      q(
        `insert into exercises (name, category, video_url) values ('Zombie Walk', 'core', 'https://youtu.be/x')`,
      ),
    );
  });
  it("names are unique ignoring case; video links must be https", async () => {
    await expect(
      asUser(db, coach, () =>
        q(`insert into exercises (name, category) values ('back squat', 'strength')`),
      ),
    ).rejects.toThrow(/duplicate/);
    await expect(
      asUser(db, coach, () =>
        q(
          `insert into exercises (name, category, video_url) values ('X Lift', 'core', 'javascript:alert(1)')`,
        ),
      ),
    ).rejects.toThrow(/check/);
  });
  it("clients can't switch their own new features on", async () => {
    await q(`update profiles set feat_habits = false where id = $1`, [alice]);
    await expect(
      asUser(db, alice, () =>
        q(`update profiles set feat_habits = true where id = $1`, [alice]),
      ),
    ).rejects.toThrow(/Only the coach/);
  });
});

describe("program templates (030)", () => {
  it("are coach-only", async () => {
    await makeProgram();
    const r = await asUser(db, alice, () =>
      q(`select count(*)::int n from programs`),
    );
    expect(r.rows[0].n).toBe(0);
  });
  it("rejects a day past the program's length and trims weeks on shrink", async () => {
    const pid = await makeProgram();
    await expect(
      asUser(db, coach, () =>
        q(`insert into program_days (program_id, week_no, day_no) values ($1, 3, 1)`, [pid]),
      ),
    ).rejects.toThrow(/past the end/);
    await asUser(db, coach, () => q(`select copy_program_week($1, 1, 2)`, [pid]));
    await asUser(db, coach, () => q(`update programs set weeks = 1 where id = $1`, [pid]));
    const r = await q(`select max(week_no)::int w from program_days where program_id = $1`, [pid]);
    expect(r.rows[0].w).toBe(1);
  });
  it("progresses a week: +2.5%, +1 set, +0.5 RPE", async () => {
    const pid = await makeProgram();
    await asUser(db, coach, () =>
      q(`select progress_program_week($1, 1, 2, 2.5, 0.5, 1, 0)`, [pid]),
    );
    const r = await q(
      `select i.sets, i.percent::float p, i.rpe::float r, i.kind from program_items i
       join program_days d on d.id = i.day_id where d.program_id = $1 and d.week_no = 2
       order by d.day_no, i.position`,
      [pid],
    );
    expect(r.rows).toEqual([
      { sets: 5, p: 82.5, r: null, kind: "exercise" },
      { sets: null, p: null, r: null, kind: "text" },
      { sets: 4, p: null, r: 7.5, kind: "exercise" },
    ]);
  });
  it("a percent line needs a percent; an exercise line needs an exercise", async () => {
    const pid = await makeProgram();
    const day = await q(`select id from program_days where program_id = $1 limit 1`, [pid]);
    await expect(
      asUser(db, coach, () =>
        q(`insert into program_items (day_id, exercise_id, load_type) values ($1, $2, 'percent')`, [
          day.rows[0].id,
          null,
        ]),
      ),
    ).rejects.toThrow(/check/);
  });
  it("duplicates a whole program", async () => {
    const pid = await makeProgram();
    const r = await asUser(db, coach, () =>
      q(`select duplicate_program($1, 'Fight camp v2') id`, [pid]),
    );
    const n = await q(
      `select count(*)::int n from program_items i join program_days d on d.id = i.day_id where d.program_id = $1`,
      [r.rows[0].id],
    );
    expect(n.rows[0].n).toBe(3);
  });
});

describe("assignment and dated workouts (031)", () => {
  it("assigning to a client dates each day from the start date", async () => {
    const pid = await makeProgram();
    await asUser(db, coach, () =>
      q(`select assign_program($1, $2, null, '2026-12-07')`, [pid, alice]),
    );
    const r = await asUser(db, alice, () =>
      q(`select workout_date::text d, title from my_workouts('2026-12-01', '2026-12-31')`),
    );
    expect(r.rows).toEqual([
      { d: "2026-12-07", title: "Lower" },
      { d: "2026-12-09", title: "Fight camp · W1D3" },
    ]);
    const other = await asUser(db, bob, () =>
      q(`select count(*)::int n from workouts`),
    );
    expect(other.rows[0].n).toBe(0);
  });
  it("group workouts reach every member; an override replaces it for one member only", async () => {
    const pid = await makeProgram();
    const g = await asUser(db, coach, async () => {
      const g = await q(`insert into groups (name) values ('Pro MMA') returning id`);
      await q(`insert into group_members (group_id, athlete_id) values ($1, $2), ($1, $3)`, [
        g.rows[0].id,
        alice,
        bob,
      ]);
      await q(`select assign_program($1, null, $2, '2026-12-07')`, [pid, g.rows[0].id]);
      return g.rows[0].id as string;
    });
    const gw = await q(
      `select id from workouts where group_id = $1 and workout_date = '2026-12-07'`,
      [g],
    );
    await asUser(db, coach, () =>
      q(`select override_workout($1, $2)`, [gw.rows[0].id, alice]),
    );
    await asUser(db, coach, () =>
      q(`update workouts set title = 'Alice lower' where overrides_id = $1`, [gw.rows[0].id]),
    );
    const a = await asUser(db, alice, () =>
      q(`select title from my_workouts('2026-12-07', '2026-12-07')`),
    );
    const b = await asUser(db, bob, () =>
      q(`select title from my_workouts('2026-12-07', '2026-12-07')`),
    );
    expect(a.rows).toEqual([{ title: "Alice lower" }]);
    expect(b.rows).toEqual([{ title: "Lower" }]);
    const coachView = await asUser(db, coach, () =>
      q(`select title from client_workouts($1, '2026-12-07', '2026-12-07')`, [alice]),
    );
    expect(coachView.rows).toEqual([{ title: "Alice lower" }]);
  });
  it("clients can't create or edit workouts", async () => {
    await expect(
      asUser(db, alice, () =>
        q(`insert into workouts (athlete_id, workout_date, title) values ($1, '2026-12-01', 'Mine')`, [alice]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("logging (032)", () => {
  async function aliceWorkoutToday() {
    const d = await today();
    return asUser(db, coach, async () => {
      const w = await q(
        `insert into workouts (athlete_id, workout_date, title) values ($1, $2, 'Today') returning id`,
        [alice, d],
      );
      const i = await q(
        `insert into workout_items (workout_id, exercise_id, sets, reps) values ($1, $2, 3, '5') returning id`,
        [w.rows[0].id, await exerciseId("Back Squat")],
      );
      return { w: w.rows[0].id as string, item: i.rows[0].id as string };
    });
  }

  it("a client logs sets, comments and finishes", async () => {
    const { w, item } = await aliceWorkoutToday();
    await asUser(db, alice, async () => {
      const l = await q(`insert into workout_logs (workout_id) values ($1) returning id`, [w]);
      const lid = l.rows[0].id;
      await q(
        `insert into set_logs (log_id, item_id, set_no, reps, load_kg) values ($1, $2, 1, 5, 100), ($1, $2, 2, 5, 100)`,
        [lid, item],
      );
      await q(`insert into item_logs (log_id, item_id, done, comment) values ($1, $2, true, 'Felt quick')`, [
        lid,
        item,
      ]);
      await q(
        `update workout_logs set completed_at = now(), session_rpe = 7, duration_min = 60, comment = 'Good' where id = $1`,
        [lid],
      );
    });
    const r = await asUser(db, coach, () =>
      q(`select count(*)::int n from set_logs`),
    );
    expect(r.rows[0].n).toBe(2);
    const other = await asUser(db, bob, () => q(`select count(*)::int n from workout_logs`));
    expect(other.rows[0].n).toBe(0);
  });
  it("finishing needs RPE and duration", async () => {
    const { w } = await aliceWorkoutToday();
    await expect(
      asUser(db, alice, () =>
        q(`insert into workout_logs (workout_id, completed_at) values ($1, now())`, [w]),
      ),
    ).rejects.toThrow(/check/);
  });
  it("can't log someone else's workout, or an item from another workout", async () => {
    const { w, item } = await aliceWorkoutToday();
    await expect(
      asUser(db, bob, () => q(`insert into workout_logs (workout_id) values ($1)`, [w])),
    ).rejects.toThrow(/not yours/);
    const d = await today();
    const other = await asUser(db, coach, async () => {
      const w2 = await q(
        `insert into workouts (athlete_id, workout_date, title) values ($1, $2, 'B') returning id`,
        [bob, d],
      );
      return w2.rows[0].id as string;
    });
    const bl = await asUser(db, bob, () =>
      q(`insert into workout_logs (workout_id) values ($1) returning id`, [other]),
    );
    await expect(
      asUser(db, bob, () =>
        q(`insert into set_logs (log_id, item_id, set_no) values ($1, $2, 1)`, [bl.rows[0].id, item]),
      ),
    ).rejects.toThrow(/not part of this workout/);
  });
  it("switching the program feature off blocks logging", async () => {
    const { w } = await aliceWorkoutToday();
    await q(`update profiles set feat_program = false where id = $1`, [alice]);
    await expect(
      asUser(db, alice, () => q(`insert into workout_logs (workout_id) values ($1)`, [w])),
    ).rejects.toThrow(/switched off/);
  });
  it("old weeks are locked", async () => {
    const w = await asUser(db, coach, () =>
      q(
        `insert into workouts (athlete_id, workout_date, title) values ($1, sydney_today() - 60, 'Old') returning id`,
        [alice],
      ),
    );
    await expect(
      asUser(db, alice, () => q(`insert into workout_logs (workout_id) values ($1)`, [w.rows[0].id])),
    ).rejects.toThrow(/locked/);
  });
  it("unassigning removes future unlogged workouts but keeps logged ones", async () => {
    const pid = await makeProgram();
    const d = await today();
    const a = await asUser(db, coach, () =>
      q(`select assign_program($1, $2, null, $3::date) id`, [pid, alice, d]),
    );
    const first = await q(
      `select id from workouts where athlete_id = $1 and workout_date = $2::date`,
      [alice, d],
    );
    await asUser(db, alice, () =>
      q(`insert into workout_logs (workout_id) values ($1)`, [first.rows[0].id]),
    );
    const n = await asUser(db, coach, () =>
      q(`select unassign_program($1) n`, [a.rows[0].id]),
    );
    expect(n.rows[0].n).toBe(1);
    const left = await q(`select count(*)::int n from workouts where athlete_id = $1`, [alice]);
    expect(left.rows[0].n).toBe(1);
  });
});
