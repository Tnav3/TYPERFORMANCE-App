import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);

beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Coach");
  alice = await signUp(db, "alice@typ.test", "Alice Smith");
  bob = await signUp(db, "bob@typ.test", "Bob");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id in ($1, $2)`, [alice, bob]);
  // Alice missed two sessions this week; Bob did his.
  await q(`insert into workouts (athlete_id, workout_date, title) values ($1, sydney_today() - 3, 'A'), ($1, sydney_today() - 2, 'B')`, [alice]);
  const w = await q(`insert into workouts (athlete_id, workout_date, title) values ($1, sydney_today() - 2, 'C') returning id, workout_date`, [bob]);
  await q(`insert into workout_logs (workout_id, athlete_id, workout_date, completed_at, logged_by, session_rpe, duration_min) values ($1, $2, $3, now(), $2, 6, 45)`, [w.rows[0].id, bob, w.rows[0].workout_date]);
});

describe("automations (054)", () => {
  it("messages only the client who matches, once per cooldown", async () => {
    const id = await asUser(db, coach, async () =>
      (await q(`insert into automations (name, trigger, threshold, body, active) values ('Missed 2', 'missed_sessions', 2, 'Hey {first_name}, all good?', true) returning id`)).rows[0].id as string,
    );
    const preview = await asUser(db, coach, () => q(`select full_name from automation_preview($1)`, [id]));
    expect(preview.rows).toEqual([{ full_name: "Alice Smith" }]);
    expect((await asUser(db, coach, () => q(`select run_automations(true) n`))).rows[0].n).toBe(1);
    const msgs = await q(`select athlete_id, sender_id, body from messages`);
    expect(msgs.rows).toEqual([{ athlete_id: alice, sender_id: coach, body: "Hey Alice, all good?" }]);
    expect((await asUser(db, coach, () => q(`select run_automations(true) n`))).rows[0].n).toBe(0);
  });

  it("can alert the coach instead of the client", async () => {
    await asUser(db, coach, () => q(`insert into automations (name, trigger, threshold, audience, body, active) values ('Missed', 'missed_sessions', 1, 'coach', 'x', true)`));
    await asUser(db, coach, () => q(`select run_automations(true)`));
    expect((await q(`select count(*)::int n from messages`)).rows[0].n).toBe(0);
    const n = await q(`select user_id, body from notifications where kind = 'reminder'`);
    expect(n.rows).toEqual([{ user_id: coach, body: "Alice Smith: 2 missed in the last 7 days" }]);
  });

  it("is coach-only", async () => {
    await expect(asUser(db, alice, () => q(`insert into automations (name, trigger, threshold, body) values ('x', 'missed_sessions', 1, 'x')`))).rejects.toThrow(/row-level/);
    await expect(asUser(db, alice, () => q(`select run_automations(true)`))).rejects.toThrow(/Coach only/);
    await expect(asUser(db, alice, () => q(`select run_automations()`))).rejects.toThrow(/permission denied/);
  });
});

describe("more automations (063)", () => {
  it("birthday message and a post-fight form", async () => {
    await q(`update profiles set birthday = (sydney_today() - interval '30 years')::date, next_fight_date = sydney_today() - 1 where id = $1`, [alice]);
    const form = (await q(`select id from forms limit 1`)).rows[0].id;
    await asUser(db, coach, async () => {
      await q(`insert into automations (name, trigger, threshold, body, cooldown_days, active) values ('Birthday', 'birthday', 0, 'Happy birthday {first_name}!', 300, true)`);
      await q(`insert into automations (name, trigger, threshold, body, form_id, active) values ('Post-fight', 'fight_done', 1, 'Proud of you. Fill this in when ready.', $1, true)`, [form]);
      await q(`select run_automations(true)`);
    });
    const msgs = (await q(`select body from messages where athlete_id = $1 order by body`, [alice])).rows.map((r) => r.body);
    expect(msgs).toEqual(["Happy birthday Alice!", "Proud of you. Fill this in when ready."]);
    const fa = await q(`select repeat, active from form_assignments where athlete_id = $1 and form_id = $2`, [alice, form]);
    expect(fa.rows).toEqual([{ repeat: "once", active: true }]);
  });
});
