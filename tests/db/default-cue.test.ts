import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "./harness";

let db: PGlite;
const q = (sql: string, params: unknown[] = []) =>
  db.query<Record<string, unknown>>(sql, params);
const MIGRATION = readFileSync(
  "supabase/migrations/106_exercise_default_cue.sql",
  "utf8",
);
beforeEach(async () => {
  db = await freshDb();
});

const cue = async (name: string) =>
  (
    await q(
      `select default_notes from exercises where lower(name) = lower($1)`,
      [name],
    )
  ).rows[0]?.default_notes as string | null;

describe("default cue (106)", () => {
  it("seeds a cue for library exercises and leaves the coach's own alone on re-run", async () => {
    expect(await cue("Back Squat")).toMatch(/Spread the floor/);
    expect(await cue("Barbell RDL")).toMatch(/hips back/);
    expect(await cue("Trap Bar Deadlift")).toMatch(/handles/);
    expect(await cue("Hip Thrust")).toMatch(/heels/);
    await q(`insert into exercises (name, category, measure, cues) values
      ('TEST - Pull Up Max', 'v_pull', 'bodyweight', null),
      ('Incline Bench Straight Leg Raise', 'core', 'bodyweight', null),
      ('Behind the Neck Press', 'v_press', 'load', null),
      ('Mystery Move', 'core', 'bodyweight', E'Steps\n1. Do it\n\nTip\nKeep it smooth.')`);
    await q(
      `update exercises set default_notes = 'My own cue' where name = 'Back Squat'`,
    );
    await db.exec(MIGRATION);
    expect(await cue("Back Squat")).toBe("My own cue");
    expect(await cue("TEST - Pull Up Max")).toBeNull();
    expect(await cue("Incline Bench Straight Leg Raise")).toMatch(
      /ribs towards the hips/,
    );
    expect(await cue("Behind the Neck Press")).toMatch(/head through/);
    expect(await cue("Mystery Move")).toBe("Keep it smooth.");
  });

  it("moves rest written in template notes into the Rest box", async () => {
    const p = (
      await q(
        `insert into programs (name, weeks) values ('ESD', 1) returning id`,
      )
    ).rows[0].id;
    const d = (
      await q(
        `insert into program_days (program_id, week_no, day_no) values ($1, 1, 1) returning id`,
        [p],
      )
    ).rows[0].id;
    const ex = (await q(`select id from exercises limit 1`)).rows[0].id;
    const notes = [
      "5 rounds x 3 min sparring | 45s rest between rounds | RPE 8.5",
      "6 rolls x 6 min | 1 min 30 rest between rolls | RPE 8",
      "3 sets x 8 reps of 30s work / 30s passive rest | Benchmark | 3 min rest between sets | RPE 8.5",
      "4 reps x 4 min | Benchmark | 2 min 30 active recovery at RPE 3 | RPE 8.5",
      "5 rounds x 1 min | no rest, fresh partner each round | RPE 10",
      "1 set x 8 reps of 20s all-out / 10s passive rest | RPE 10",
      "Pop off the floor",
    ];
    for (const [i, n] of notes.entries())
      await q(
        `insert into program_items (day_id, position, kind, exercise_id, block, slot, sets, notes) values ($1, $2, 'exercise', $3, 'A', 1, 3, $4)`,
        [d, i + 1, ex, n],
      );
    await db.exec(MIGRATION);
    const r = await q(
      `select rest_sec from program_items where day_id = $1 order by position`,
      [d],
    );
    expect(r.rows.map((x) => x.rest_sec)).toEqual([
      45,
      90,
      180,
      150,
      0,
      null,
      null,
    ]);
  });
});

describe("stale maxes (109)", () => {
  it("has a 2–52 week setting (default 8) and accepts session-saved maxes", async () => {
    expect((await q(`select stale_max_weeks from app_settings`)).rows[0].stale_max_weeks).toBe(8);
    await expect(q(`update app_settings set stale_max_weeks = 1`)).rejects.toThrow();
    const a = (await q(`insert into auth.users (email) values ('x@typ.test') returning id`)).rows[0].id;
    const r = await q(
      `insert into lift_maxes (athlete_id, lift_key, load_kg, reps, entered_by, source) values ($1, 'back_squat', 100, 7, $1, 'session') returning e1rm_kg::float e`,
      [a],
    );
    expect(r.rows[0].e).toBeGreaterThan(115);
  });
});
