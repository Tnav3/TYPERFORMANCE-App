import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, mt: string, bag: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);

beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Tyrell");
  alice = await signUp(db, "alice@typ.test", "Alice");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id = $1`, [alice]);
  const r = await q(`select d.id as d, s.id as s from session_types s join disciplines d on d.id = s.discipline_id
                     where d.name = 'Muay Thai' and s.name = 'Bag work'`);
  mt = r.rows[0].d as string;
  bag = r.rows[0].s as string;
});

const off = (col: string) => q(`update profiles set ${col} = false where id = $1`, [alice]);
const session = (uid: string) =>
  asUser(db, uid, () =>
    q(`insert into training_sessions (athlete_id, session_date, start_time, duration_min, discipline_id, session_type_id, rpe)
       values ($1, sydney_today(), '18:00', 60, $2, $3, 6)`, [alice, mt, bag]));
const checkin = (uid: string) =>
  asUser(db, uid, () =>
    q(`insert into weekly_checkins (athlete_id, week_start, wellness) values ($1, week_monday(sydney_today()), 7)`, [alice]));
const test = (uid: string) =>
  asUser(db, uid, () =>
    q(`insert into test_entries (athlete_id, test_key, tested_on, values) values ($1, 'broad_jump', sydney_today(), '{"best_cm": 240}')`, [alice]));
const max = (uid: string) =>
  asUser(db, uid, () =>
    q(`insert into lift_maxes (athlete_id, lift_key, load_kg, reps, e1rm_kg) values ($1, 'bench', 100, 3, 0)`, [alice]));

describe("feature switches", () => {
  it("everyone starts with every feature on", async () => {
    const r = await q(`select feat_checkin, feat_testing, feat_1rm, feat_mas from profiles where id = $1`, [alice]);
    expect(r.rows[0]).toEqual({ feat_checkin: true, feat_testing: true, feat_1rm: true, feat_mas: true });
    const r2 = await q(`select feat_rpe, feat_hr from profiles where id = $1`, [alice]);
    expect(r2.rows[0]).toEqual({ feat_rpe: true, feat_hr: true });
  });

  it("only the coach can change them", async () => {
    await expect(
      asUser(db, alice, () => q(`update profiles set feat_testing = false where id = $1`, [alice])),
    ).rejects.toThrow(/Only the coach/);
    await expect(
      asUser(db, alice, () => q(`update profiles set feat_hr = false where id = $1`, [alice])),
    ).rejects.toThrow(/Only the coach/);
    await expect(
      asUser(db, alice, () => q(`update profiles set feat_rpe = false where id = $1`, [alice])),
    ).rejects.toThrow(/Only the coach/);
    await asUser(db, coach, () => q(`update profiles set feat_testing = false where id = $1`, [alice]));
    const r = await q(`select feat_testing from profiles where id = $1`, [alice]);
    expect(r.rows[0].feat_testing).toBe(false);
  });

  it("athletes can still edit their own profile details", async () => {
    await asUser(db, alice, () => q(`update profiles set weight_class = 'Featherweight' where id = $1`, [alice]));
  });

  it("all saves work while features are on", async () => {
    await session(alice);
    await checkin(alice);
    await test(alice);
    await max(alice);
  });

  it("check-in off blocks sessions and check-ins", async () => {
    await off("feat_checkin");
    await expect(session(alice)).rejects.toThrow(/switched off/);
    await expect(checkin(alice)).rejects.toThrow(/switched off/);
    await test(alice); // other features unaffected
  });

  it("testing off blocks test results; 1RM off blocks saved maxes", async () => {
    await off("feat_testing");
    await off("feat_1rm");
    await expect(test(alice)).rejects.toThrow(/switched off/);
    await expect(max(alice)).rejects.toThrow(/switched off/);
    await session(alice);
  });

  it("the coach can still enter data for an athlete with features off", async () => {
    await off("feat_testing");
    await off("feat_1rm");
    await test(coach);
    await max(coach);
  });
});
