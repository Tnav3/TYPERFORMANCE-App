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

describe("titles (083)", () => {
  it("athlete and coach can add; others can't see or add", async () => {
    await asUser(db, alice, () => q(`insert into titles (org, name, colour) values ('ISKA', 'Aus Welterweight', 'red')`));
    await asUser(db, coach, () => q(`insert into titles (athlete_id, org) values ($1, 'WBC')`, [alice]));
    expect((await asUser(db, alice, () => q(`select org from titles order by org`))).rows.map((r) => r.org)).toEqual(["ISKA", "WBC"]);
    expect((await asUser(db, bob, () => q(`select * from titles`))).rows).toHaveLength(0);
    await expect(asUser(db, bob, () => q(`insert into titles (athlete_id, org) values ($1, 'FAKE')`, [alice]))).rejects.toThrow(/row-level/);
    await expect(asUser(db, alice, () => q(`insert into titles (org, colour) values ('WBA', 'pink')`))).rejects.toThrow();
  });
});

describe("fight level (084)", () => {
  it("fights default to amateur, can be pro; profile stores the current level", async () => {
    await asUser(db, alice, () => q(`insert into fights (fought_on, result, rounds) values ('2026-01-01', 'win', 3)`));
    await asUser(db, alice, () => q(`insert into fights (fought_on, result, rounds, level) values ('2026-06-01', 'win', 5, 'pro')`));
    expect((await q(`select level from fights where athlete_id = $1 order by fought_on`, [alice])).rows.map((r) => r.level)).toEqual(["amateur", "pro"]);
    await asUser(db, alice, () => q(`update profiles set fight_level = 'pro' where id = $1`, [alice]));
    await expect(q(`update profiles set fight_level = 'semi' where id = $1`, [alice])).rejects.toThrow();
  });
});
