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

describe("player card cache (082)", () => {
  it("clients keep their own card; others can't read it; coach can", async () => {
    await asUser(db, alice, () => q(`insert into player_cards (overall, tier, seen_overall) values (74, 'silver', 72)`));
    await asUser(db, alice, () => q(`update player_cards set seen_overall = 74`));
    expect((await asUser(db, bob, () => q(`select * from player_cards`))).rows).toHaveLength(0);
    await expect(asUser(db, bob, () => q(`insert into player_cards (athlete_id, overall) values ($1, 99)`, [alice]))).rejects.toThrow(/row-level/);
    const c = await asUser(db, coach, () => q(`select overall, seen_overall from player_cards where athlete_id = $1`, [alice]));
    expect(c.rows[0]).toEqual({ overall: 74, seen_overall: 74 });
    await expect(asUser(db, alice, () => q(`update player_cards set tier = 'legend'`))).rejects.toThrow();
  });
});

describe("player card refresh (087)", () => {
  it("a new test marks the cached card stale, even when the coach enters it", async () => {
    await asUser(db, alice, () => q(`insert into player_cards (overall, tier, seen_overall, updated_on) values (74, 'silver', 74, '2026-11-25')`));
    await asUser(db, coach, () => q(`insert into test_entries (athlete_id, test_key, tested_on, values) values ($1, 'broad_jump', '2026-11-20', '{"best_cm": 240}')`, [alice]));
    expect((await q(`select updated_on::text d from player_cards where athlete_id = $1`, [alice])).rows[0].d).toBe("2000-01-01");
  });
});

describe("open notification (088)", () => {
  it("marks only your own notification read and returns its link", async () => {
    const n = await q(`insert into notifications (user_id, kind, title, body, url) values ($1, 'message', 'Hi', 'There', '/chat') returning id`, [alice]);
    const id = n.rows[0].id as string;
    expect((await asUser(db, bob, () => q(`select public.open_notification($1) u`, [id]))).rows[0].u).toBeNull();
    expect((await asUser(db, alice, () => q(`select public.open_notification($1) u`, [id]))).rows[0].u).toBe("/chat");
    expect((await q(`select read_at is not null r from notifications where id = $1`, [id])).rows[0].r).toBe(true);
  });
});
