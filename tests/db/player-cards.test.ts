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
