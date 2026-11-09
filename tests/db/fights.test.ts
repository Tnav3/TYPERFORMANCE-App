import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string, pending: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);

beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Tyrell");
  alice = await signUp(db, "alice@typ.test", "Alice");
  bob = await signUp(db, "bob@typ.test", "Bob");
  pending = await signUp(db, "pend@typ.test", "Pete");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id in ($1, $2)`, [alice, bob]);
});

const log = (uid: string, athlete: string, result = "win", rounds = 3, daysAgo = 1) =>
  asUser(db, uid, () =>
    q(
      `insert into fights (athlete_id, fought_on, result, rounds) values ($1, sydney_today() - $2::int, $3, $4) returning entered_by`,
      [athlete, daysAgo, result, rounds],
    ),
  );

describe("fights", () => {
  it("athletes log their own; coach logs for anyone", async () => {
    const a = await log(alice, alice);
    expect(a.rows[0].entered_by).toBe(alice);
    const c = await log(coach, bob, "loss", 5);
    expect(c.rows[0].entered_by).toBe(coach);
  });
  it("can't log for someone else, or while pending", async () => {
    await expect(log(alice, bob)).rejects.toThrow(/row-level security/);
    await expect(log(pending, pending)).rejects.toThrow(/row-level security/);
  });
  it("only win / loss / draw, rounds 1–15, no future dates", async () => {
    await expect(log(alice, alice, "ko")).rejects.toThrow(/check/);
    await expect(log(alice, alice, "win", 0)).rejects.toThrow(/check/);
    await expect(log(alice, alice, "win", 16)).rejects.toThrow(/check/);
    await expect(log(alice, alice, "win", 3, -1)).rejects.toThrow(/future/);
  });
  it("athletes see only their own; coach sees all", async () => {
    await log(alice, alice);
    await log(bob, bob, "draw");
    const a = await asUser(db, alice, () => q(`select result from fights`));
    expect(a.rows).toEqual([{ result: "win" }]);
    const c = await asUser(db, coach, () => q(`select count(*)::int as n from fights`));
    expect(c.rows[0].n).toBe(2);
  });
  it("athletes can fix their own result but not move it to someone else", async () => {
    await log(alice, alice);
    await asUser(db, alice, () => q(`update fights set result = 'loss', athlete_id = $1`, [bob]));
    const r = await q(`select athlete_id, result from fights`);
    expect(r.rows[0]).toEqual({ athlete_id: alice, result: "loss" });
  });
  it("switch off blocks the athlete, not the coach", async () => {
    await q(`update profiles set feat_fights = false where id = $1`, [alice]);
    await expect(log(alice, alice)).rejects.toThrow(/switched off/);
    await log(coach, alice);
    await expect(
      asUser(db, alice, () => q(`update profiles set feat_fights = true where id = $1`, [alice])),
    ).rejects.toThrow(/Only the coach/);
  });
  it("athletes delete only their own", async () => {
    await log(bob, bob);
    const d = await asUser(db, alice, () => q(`delete from fights returning id`));
    expect(d.rows).toHaveLength(0);
  });
});

describe("two planned fights (migration 017)", () => {
  it("second fight must come after the next fight", async () => {
    await asUser(db, alice, () =>
      q(`update profiles set next_fight_date = sydney_today() + 30, second_fight_date = sydney_today() + 60 where id = $1`, [alice]));
    await expect(
      asUser(db, alice, () => q(`update profiles set second_fight_date = sydney_today() + 10 where id = $1`, [alice])),
    ).rejects.toThrow(/second_fight_after_next/);
    await expect(
      asUser(db, alice, () => q(`update profiles set next_fight_date = null where id = $1`, [alice])),
    ).rejects.toThrow(/second_fight_after_next/);
  });
});
