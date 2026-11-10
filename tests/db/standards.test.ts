import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);

beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Tyrell");
  alice = await signUp(db, "alice@typ.test", "Alice");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id = $1`, [alice]);
});

describe("testing standards", () => {
  it("seeds only the researched tests", async () => {
    const r = await q(`select test_key, sex, bronze::float b, silver::float s, gold::float g from test_standards order by test_key, sex`);
    expect(r.rows).toEqual([
      { test_key: "bench_3rm", sex: "male", b: 1, s: 1.2, g: 1.5 },
      { test_key: "box_squat_3rm", sex: "male", b: 1.55, s: 1.85, g: 2.05 },
      { test_key: "cmj", sex: "female", b: 22, s: 25, g: 28 },
      { test_key: "cmj", sex: "male", b: 31, s: 36, g: 41 },
    ]);
    const src = await q(`select count(*)::int n from test_standards where source is null`);
    expect(src.rows[0].n).toBe(0);
  });
  it("everyone can read; only the coach can change", async () => {
    const a = await asUser(db, alice, () => q(`select count(*)::int n from test_standards`));
    expect(a.rows[0].n).toBe(4);
    const u = await asUser(db, alice, () => q(`update test_standards set gold = 99 returning 1`));
    expect(u.rows).toHaveLength(0);
    await expect(
      asUser(db, alice, () => q(`insert into test_standards (test_key, sex, gold) values ('chin_ups', 'male', 20)`)),
    ).rejects.toThrow(/row-level security/);
    await asUser(db, coach, () => q(`insert into test_standards (test_key, sex, bronze, silver, gold) values ('chin_ups', 'male', 8, 12, 18)`));
  });
  it("levels must rise Bronze < Silver < Gold", async () => {
    await expect(
      asUser(db, coach, () => q(`insert into test_standards (test_key, sex, bronze, silver) values ('chin_ups', 'female', 10, 8)`)),
    ).rejects.toThrow(/check/);
    await expect(
      asUser(db, coach, () => q(`insert into test_standards (test_key, sex, bronze, gold) values ('chin_ups', 'female', 10, 10)`)),
    ).rejects.toThrow(/check/);
  });
  it("profile sex is optional and limited to male/female", async () => {
    await asUser(db, alice, () => q(`update profiles set sex = 'female' where id = $1`, [alice]));
    await expect(asUser(db, alice, () => q(`update profiles set sex = 'x' where id = $1`, [alice]))).rejects.toThrow(/check/);
    await asUser(db, alice, () => q(`update profiles set sex = null where id = $1`, [alice]));
  });
});
