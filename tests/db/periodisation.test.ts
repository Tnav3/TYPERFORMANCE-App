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
