import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string;
const q = (sql: string, params: unknown[] = []) =>
  db.query<Record<string, unknown>>(sql, params);

beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Tyrell");
  alice = await signUp(db, "alice@typ.test", "Alice");
  bob = await signUp(db, "bob@typ.test", "Bob");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id in ($1, $2)`, [
    alice,
    bob,
  ]);
});

const sided = (
  uid: string,
  athlete: string,
  key: string,
  l: number,
  r: number,
  daysAgo = 0,
) =>
  asUser(db, uid, () =>
    q(
      `insert into rom_entries (athlete_id, measure_key, measured_on, left_value, right_value)
       values ($1, $2, sydney_today() - $3::int, $4, $5) returning id, entered_by`,
      [athlete, key, daysAgo, l, r],
    ),
  );
const single = (uid: string, athlete: string, key: string, v: number) =>
  asUser(db, uid, () =>
    q(
      `insert into rom_entries (athlete_id, measure_key, value) values ($1, $2, $3) returning id`,
      [athlete, key, v],
    ),
  );

describe("mobility screen", () => {
  it("seeds 18 measures; only knee-to-wall and lumbar-locked rotation are self-tests", async () => {
    const r = await q(`select count(*)::int n from rom_measures`);
    expect(r.rows[0].n).toBe(18);
    const s = await q(
      `select key from rom_measures where self_test order by key`,
    );
    expect(s.rows.map((x) => x.key)).toEqual([
      "knee_to_wall",
      "lumbar_locked_rotation",
    ]);
    const noSource = await q(
      `select count(*)::int n from rom_measures where source is null`,
    );
    expect(noSource.rows[0].n).toBe(0);
  });
  it("clients enter self-tests only; the coach enters anything for anyone", async () => {
    const a = await sided(alice, alice, "knee_to_wall", 11, 9);
    expect(a.rows[0].entered_by).toBe(alice);
    await expect(sided(alice, alice, "hip_ir", 40, 38)).rejects.toThrow(
      /Only your coach/,
    );
    const c = await sided(coach, alice, "hip_ir", 40, 38);
    expect(c.rows[0].entered_by).toBe(coach);
  });
  it("no entries for someone else, no future dates", async () => {
    await expect(sided(alice, bob, "knee_to_wall", 11, 9)).rejects.toThrow(
      /row-level security/,
    );
    await expect(
      sided(alice, alice, "knee_to_wall", 11, 9, -1),
    ).rejects.toThrow(/future/);
  });
  it("sided measures need left and right; single measures one value", async () => {
    await expect(single(coach, alice, "hip_ir", 40)).rejects.toThrow(
      /left and a right/,
    );
    await expect(
      sided(coach, alice, "cervical_flexion", 40, 40),
    ).rejects.toThrow(/single value/);
    await single(coach, alice, "cervical_flexion", 48);
  });
  it("clients see their own results only; can't delete the coach's", async () => {
    await sided(coach, alice, "hip_ir", 40, 38);
    await sided(coach, bob, "hip_ir", 30, 30);
    const seen = await asUser(db, alice, () =>
      q(`select athlete_id from rom_entries`),
    );
    expect(seen.rows.every((r) => r.athlete_id === alice)).toBe(true);
    expect(seen.rows).toHaveLength(1);
    const del = await asUser(db, alice, () =>
      q(`delete from rom_entries returning id`),
    );
    expect(del.rows).toHaveLength(0);
    const own = await sided(alice, alice, "knee_to_wall", 11, 9);
    const del2 = await asUser(db, alice, () =>
      q(`delete from rom_entries where id = $1 returning id`, [own.rows[0].id]),
    );
    expect(del2.rows).toHaveLength(1);
  });
  it("the switch blocks client saves (not the coach's), and only the coach can flip it", async () => {
    await q(`update profiles set feat_mobility = false where id = $1`, [alice]);
    await expect(sided(alice, alice, "knee_to_wall", 11, 9)).rejects.toThrow(
      /switched off/,
    );
    await sided(coach, alice, "hip_ir", 40, 38);
    await expect(
      asUser(db, alice, () =>
        q(`update profiles set feat_mobility = true where id = $1`, [alice]),
      ),
    ).rejects.toThrow(/Only the coach/);
  });
  it("only the coach can change norms", async () => {
    const u = await asUser(db, alice, () =>
      q(`update rom_measures set norm = 1 returning key`),
    );
    expect(u.rows).toHaveLength(0);
    const c = await asUser(db, coach, () =>
      q(
        `update rom_measures set norm = 44 where key = 'hip_ir' returning norm::float n`,
      ),
    );
    expect(c.rows[0].n).toBe(44);
  });
});

describe("nutrition switch (migration 025)", () => {
  it("defaults on; only the coach can flip it", async () => {
    const r = await q(`select feat_nutrition from profiles where id = $1`, [alice]);
    expect(r.rows[0].feat_nutrition).toBe(true);
    await expect(
      asUser(db, alice, () => q(`update profiles set feat_nutrition = false where id = $1`, [alice])),
    ).rejects.toThrow(/Only the coach/);
    await asUser(db, coach, () => q(`update profiles set feat_nutrition = false where id = $1`, [alice]));
  });
});
