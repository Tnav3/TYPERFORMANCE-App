import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);

beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Coach");
  alice = await signUp(db, "alice@typ.test", "Alice Smith");
  await makeCoach(db, "coach@typ.test");
});

describe("onboarding sequences (044)", () => {
  it("approval enrols the client; due steps arrive as chat with their first name, once", async () => {
    await asUser(db, coach, async () => {
      const s = await q(`insert into sequences (name) values ('Welcome') returning id`);
      await q(
        `insert into sequence_steps (sequence_id, day_offset, send_time, body) values
          ($1, 0, '00:00', 'Welcome {first_name}!'), ($1, 3, '09:00', 'Day 3 check-in')`,
        [s.rows[0].id],
      );
    });
    await asUser(db, coach, () => q(`update profiles set status = 'active' where id = $1`, [alice]));
    const e = await q(`select count(*)::int n from sequence_enrollments where athlete_id = $1`, [alice]);
    expect(e.rows[0].n).toBe(1);
    expect((await q(`select send_sequence_steps() n`)).rows[0].n).toBe(1);
    expect((await q(`select send_sequence_steps() n`)).rows[0].n).toBe(0);
    const m = await asUser(db, alice, () => q(`select body, sender_id from messages`));
    expect(m.rows).toEqual([{ body: "Welcome Alice!", sender_id: coach }]);
  });
  it("is coach-only and the sender can't be run by clients", async () => {
    await q(`update profiles set status = 'active' where id = $1`, [alice]);
    const r = await asUser(db, alice, () => q(`select count(*)::int n from sequences`));
    expect(r.rows[0].n).toBe(0);
    await expect(asUser(db, alice, () => q(`select send_sequence_steps()`))).rejects.toThrow(/permission/);
  });
});
