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
});

describe("push notifications outbox (043)", () => {
  it("chat messages notify the other side; prefs are respected", async () => {
    await asUser(db, coach, () => q(`insert into messages (athlete_id, body) values ($1, 'Great session')`, [alice]));
    await asUser(db, alice, () => q(`insert into messages (athlete_id, body) values ($1, 'Thanks!')`, [alice]));
    const n = await q(`select user_id, kind, title, url from notifications order by created_at`);
    expect(n.rows).toEqual([
      { user_id: alice, kind: "message", title: "Message from your coach", url: "/chat" },
      { user_id: coach, kind: "message", title: "Alice Smith sent a message", url: `/coach/chat/${alice}` },
    ]);
    await q(`update profiles set notify_messages = false where id = $1`, [alice]);
    await asUser(db, coach, () => q(`insert into messages (athlete_id, body) values ($1, 'x')`, [alice]));
    expect((await q(`select count(*)::int n from notifications where user_id = $1`, [alice])).rows[0].n).toBe(1);
  });
  it("assigning a program notifies once per client, not per workout", async () => {
    await asUser(db, coach, async () => {
      const p = await q(`insert into programs (name, weeks) values ('Camp', 2) returning id`);
      for (const w of [1, 2]) await q(`insert into program_days (program_id, week_no, day_no) values ($1, $2, 1)`, [p.rows[0].id, w]);
      await q(`select assign_program($1, $2, null, '2026-12-07')`, [p.rows[0].id, alice]);
    });
    const n = await q(`select title from notifications where user_id = $1`, [alice]);
    expect(n.rows).toEqual([{ title: "New program: Camp" }]);
  });
  it("clients only see their own notifications and subscriptions", async () => {
    await asUser(db, alice, () =>
      q(`insert into push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/1', 'k', 'a')`),
    );
    const b = await asUser(db, bob, () => q(`select count(*)::int n from push_subscriptions`));
    expect(b.rows[0].n).toBe(0);
    await expect(asUser(db, alice, () => q(`select queue_reminders()`))).rejects.toThrow(/permission/);
  });
  it("workout reminder queues once a day when a workout is unfinished", async () => {
    await q(`update profiles set workout_reminder_time = '00:00' where id = $1`, [alice]);
    await asUser(db, coach, () => q(`insert into workouts (athlete_id, workout_date, title) values ($1, sydney_today(), 'Lower')`, [alice]));
    await q(`delete from notifications`);
    await q(`select queue_reminders()`);
    await q(`select queue_reminders()`);
    const n = await q(`select kind, body from notifications where user_id = $1`, [alice]);
    expect(n.rows).toEqual([{ kind: "reminder", body: "Lower. Tap to start." }]);
  });
});
