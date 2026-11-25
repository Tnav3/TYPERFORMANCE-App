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

describe("client notes (080)", () => {
  it("own notes only; one per exercise; coach can read", async () => {
    const ex = (await q(`select id from exercises limit 1`)).rows[0].id;
    await asUser(db, alice, () => q(`insert into client_notes (exercise_id, body) values ($1, 'Rack hole 7')`, [ex]));
    await expect(asUser(db, alice, () => q(`insert into client_notes (exercise_id, body) values ($1, 'again')`, [ex]))).rejects.toThrow();
    await asUser(db, alice, () => q(`insert into client_notes (body) values ('Bring chalk')`));
    expect((await asUser(db, bob, () => q(`select count(*)::int n from client_notes`))).rows[0].n).toBe(0);
    await expect(asUser(db, bob, () => q(`insert into client_notes (athlete_id, body) values ($1, 'x')`, [alice]))).rejects.toThrow();
    expect((await asUser(db, coach, () => q(`select count(*)::int n from client_notes`))).rows[0].n).toBe(2);
  });
});
