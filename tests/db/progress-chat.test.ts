import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string;
const q = (sql: string, params: unknown[] = []) =>
  db.query<Record<string, unknown>>(sql, params);

beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Tyrell Coach");
  alice = await signUp(db, "alice@typ.test", "Alice Smith");
  bob = await signUp(db, "bob@typ.test", "Bob Jones");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id in ($1, $2)`, [alice, bob]);
});

describe("bodyweight", () => {
  it("own entries only, one per day, not in the future", async () => {
    await asUser(db, alice, () => q(`insert into body_metrics (weight_kg) values (72.4)`));
    await expect(
      asUser(db, alice, () => q(`insert into body_metrics (weight_kg) values (72.0)`)),
    ).rejects.toThrow(/duplicate/);
    await expect(
      asUser(db, alice, () =>
        q(`insert into body_metrics (weight_kg, measured_on) values (72, sydney_today() + 1)`),
      ),
    ).rejects.toThrow(/future/);
    const b = await asUser(db, bob, () => q(`select count(*)::int n from body_metrics`));
    expect(b.rows[0].n).toBe(0);
  });
});

describe("chat", () => {
  it("client ↔ coach only; clients can't read other threads", async () => {
    await asUser(db, alice, () => q(`insert into messages (athlete_id, body) values ($1, 'Hi coach')`, [alice]));
    await asUser(db, coach, () => q(`insert into messages (athlete_id, body) values ($1, 'Hey Alice')`, [alice]));
    await expect(
      asUser(db, bob, () => q(`insert into messages (athlete_id, body) values ($1, 'sneaky')`, [alice])),
    ).rejects.toThrow(/only message your coach|row-level/);
    const b = await asUser(db, bob, () => q(`select count(*)::int n from messages`));
    expect(b.rows[0].n).toBe(0);
    const a = await asUser(db, alice, () => q(`select count(*)::int n from messages`));
    expect(a.rows[0].n).toBe(2);
  });
  it("only the recipient marks read; nobody edits text", async () => {
    await asUser(db, coach, () => q(`insert into messages (athlete_id, body) values ($1, 'Hey')`, [alice]));
    await asUser(db, alice, () => q(`update messages set read_at = now()`));
    await expect(asUser(db, alice, () => q(`update messages set body = 'changed'`))).rejects.toThrow(/edited/);
    await asUser(db, alice, () => q(`insert into messages (athlete_id, body) values ($1, 'Mine')`, [alice]));
    await expect(
      asUser(db, alice, () => q(`update messages set read_at = now() where body = 'Mine'`)),
    ).rejects.toThrow(/recipient/);
  });
  it("chat switched off blocks the client", async () => {
    await q(`update profiles set feat_chat = false where id = $1`, [alice]);
    await expect(
      asUser(db, alice, () => q(`insert into messages (athlete_id, body) values ($1, 'x')`, [alice])),
    ).rejects.toThrow(/switched off/);
  });
});

describe("scheduled and recurring messages", () => {
  it("a one-off to everyone is delivered once when due", async () => {
    await asUser(db, coach, () =>
      q(`insert into scheduled_messages (body, target, next_send_at) values ('Check-in time', 'all', now() - interval '1 minute')`),
    );
    const sent = await q(`select send_due_messages() n`);
    expect(sent.rows[0].n).toBe(2);
    const again = await q(`select send_due_messages() n`);
    expect(again.rows[0].n).toBe(0);
    const m = await asUser(db, alice, () => q(`select body, sender_id, announcement from messages`));
    expect(m.rows).toEqual([{ body: "Check-in time", sender_id: coach, announcement: true }]);
  });
  it("weekly repeats get the next matching weekday at the Sydney time", async () => {
    const r = await q(
      `select next_send_time('weekly', '{7}', null, '18:00', '2026-11-24 10:00+11', null)::text t`,
    );
    // Tue 24 Nov → next Sunday 29 Nov 18:00 Sydney = 07:00 UTC
    expect(r.rows[0].t).toMatch(/^2026-11-29 07:00:00/);
    const d = await q(
      `select next_send_time('days', null, 3, '09:00', '2026-11-24 10:00+11', '2026-11-23 09:00+11')::text t`,
    );
    expect(d.rows[0].t).toMatch(/^2026-11-25 22:00:00/); // 26 Nov 09:00 Sydney
  });
  it("recurring group message only reaches members and reschedules itself", async () => {
    const g = await asUser(db, coach, async () => {
      const g = await q(`insert into groups (name) values ('Fat loss') returning id`);
      await q(`insert into group_members (group_id, athlete_id) values ($1, $2)`, [g.rows[0].id, bob]);
      await q(
        `insert into scheduled_messages (body, target, group_id, repeat, weekdays, time_of_day) values ('Weigh in!', 'group', $1, 'weekly', '{1,2,3,4,5,6,7}', '00:00')`,
        [g.rows[0].id],
      );
      return g.rows[0].id as string;
    });
    await q(`update scheduled_messages set next_send_at = now() - interval '1 second'`);
    expect((await q(`select send_due_messages() n`)).rows[0].n).toBe(1);
    const s = await q(`select active, next_send_at > now() later, sent_count from scheduled_messages where group_id = $1`, [g]);
    expect(s.rows[0]).toEqual({ active: true, later: true, sent_count: 1 });
  });
  it("clients can't see or create schedules, or run the sender", async () => {
    const r = await asUser(db, alice, () => q(`select count(*)::int n from scheduled_messages`));
    expect(r.rows[0].n).toBe(0);
    await expect(asUser(db, alice, () => q(`select send_due_messages()`))).rejects.toThrow(/permission/);
  });
});

describe("follow-ups and app opens", () => {
  it("follow-ups are coach only; opens are one per client per day", async () => {
    await asUser(db, coach, () => q(`insert into follow_ups (athlete_id, due_on, note) values ($1, sydney_today(), 'Check knee')`, [alice]));
    const a = await asUser(db, alice, () => q(`select count(*)::int n from follow_ups`));
    expect(a.rows[0].n).toBe(0);
    await asUser(db, alice, () => q(`insert into app_opens default values on conflict do nothing`));
    await asUser(db, alice, () => q(`insert into app_opens default values on conflict do nothing`));
    const o = await q(`select count(*)::int n from app_opens`);
    expect(o.rows[0].n).toBe(1);
  });
});

describe("leaderboard", () => {
  it("shows opted-in group members' best e1RM to members with leaderboards on", async () => {
    const ex = (await q(`select id from exercises where name = 'Back Squat'`)).rows[0].id as string;
    const today = (await q(`select sydney_today()::text d`)).rows[0].d as string;
    const g = await asUser(db, coach, async () => {
      const g = await q(`insert into groups (name) values ('Pro') returning id`);
      await q(`insert into group_members (group_id, athlete_id) values ($1, $2), ($1, $3)`, [g.rows[0].id, alice, bob]);
      for (const [who, kg] of [[alice, 100], [bob, 120]] as const) {
        const w = await q(`insert into workouts (athlete_id, workout_date, title) values ($1, $2, 'S') returning id`, [who, today]);
        const i = await q(`insert into workout_items (workout_id, exercise_id, sets, reps) values ($1, $2, 1, '5') returning id`, [w.rows[0].id, ex]);
        await asUser(db, who, async () => {
          const l = await q(`insert into workout_logs (workout_id) values ($1) returning id`, [w.rows[0].id]);
          await q(`insert into set_logs (log_id, item_id, set_no, reps, load_kg) values ($1, $2, 1, 5, $3)`, [l.rows[0].id, i.rows[0].id, kg]);
        });
      }
      return g.rows[0].id as string;
    });
    // Leaderboards default off: Alice can't see it
    const off = await asUser(db, alice, () => q(`select * from group_leaderboard($1, $2)`, [g, ex]));
    expect(off.rows).toHaveLength(0);
    await q(`update profiles set feat_leaderboard = true where id in ($1, $2)`, [alice, bob]);
    const on = await asUser(db, alice, () => q(`select name, best_e1rm::float e from group_leaderboard($1, $2)`, [g, ex]));
    expect(on.rows).toEqual([
      { name: "Bob J.", e: 137.5 },
      { name: "Alice S.", e: 114.5 },
    ]);
  });
});
