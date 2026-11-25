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
});

describe("beta feedback (071)", () => {
  it("anyone signed in can report; only they and the coach see it; coach notified", async () => {
    await asUser(db, alice, () => q(`insert into feedback (kind, message, page) values ('bug', 'Timer froze', '/train/x')`));
    expect((await asUser(db, bob, () => q(`select count(*)::int n from feedback`))).rows[0].n).toBe(0);
    expect((await asUser(db, coach, () => q(`select message from feedback`))).rows).toEqual([{ message: "Timer froze" }]);
    expect((await q(`select title from notifications where user_id = $1`, [coach])).rows[0].title).toBe("Problem reported · Alice");
  });
  it("only the coach grants beta access", async () => {
    await expect(asUser(db, alice, () => q(`update profiles set beta = true where id = $1`, [alice]))).rejects.toThrow(/coach/);
    await asUser(db, coach, () => q(`update profiles set beta = true where id = $1`, [alice]));
  });
});
