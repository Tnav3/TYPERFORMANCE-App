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

describe("forms (049)", () => {
  it("ships a starter weekly check-in", async () => {
    const r = await asUser(db, coach, () => q(`select f.name, count(q.*)::int n from forms f join form_questions q on q.form_id = f.id group by 1`));
    expect(r.rows).toEqual([{ name: "Weekly check-in", n: 9 }]);
  });

  it("clients only see and answer forms sent to them", async () => {
    const f = await asUser(db, coach, async () => {
      const id = (await q(`select id from forms limit 1`)).rows[0].id;
      await q(`insert into form_assignments (form_id, athlete_id, repeat, starts_on) values ($1, $2, 'weekly', '2026-11-02')`, [id, alice]);
      return id as string;
    });
    expect((await asUser(db, alice, () => q(`select count(*)::int n from form_questions`))).rows[0].n).toBe(9);
    expect((await asUser(db, bob, () => q(`select count(*)::int n from form_questions`))).rows[0].n).toBe(0);
    await asUser(db, alice, () => q(`insert into form_responses (form_id, due_on, answers) values ($1, '2026-11-02', '{"x": 1}')`, [f]));
    await expect(asUser(db, alice, () => q(`insert into form_responses (form_id, due_on, answers) values ($1, '2026-11-02', '{}')`, [f]))).rejects.toThrow(/duplicate/);
    await expect(asUser(db, bob, () => q(`insert into form_responses (form_id, due_on, answers) values ($1, '2026-11-02', '{}')`, [f]))).rejects.toThrow(/row-level/);
    await expect(
      asUser(db, alice, () => q(`insert into form_responses (form_id, due_on, answers, coach_seen_at) values ($1, '2026-11-09', '{}', now())`, [f])),
    ).rejects.toThrow(/row-level/);
    expect((await asUser(db, bob, () => q(`select count(*)::int n from form_responses`))).rows[0].n).toBe(0);
    await expect(asUser(db, alice, () => q(`update form_responses set answers = '{}'`))).resolves.toBeDefined();
    const still = await q(`select answers from form_responses`);
    expect(still.rows[0].answers).toEqual({ x: 1 });
  });
});
