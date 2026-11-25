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

describe("assigned coach (074)", () => {
  it("coach assigns; client can't; must be a coach", async () => {
    await asUser(db, coach, () => q(`update profiles set assigned_coach = $1 where id = $2`, [coach, alice]));
    expect((await q(`select assigned_coach from profiles where id = $1`, [alice])).rows[0].assigned_coach).toBe(coach);
    await expect(asUser(db, alice, () => q(`update profiles set assigned_coach = null where id = $1`, [alice]))).rejects.toThrow(/Only a coach/);
    await expect(asUser(db, coach, () => q(`update profiles set assigned_coach = $1 where id = $2`, [bob, alice]))).rejects.toThrow(/must be a coach/);
  });
});
