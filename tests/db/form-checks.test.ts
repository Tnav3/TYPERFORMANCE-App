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
  await q(`update profiles set status = 'active', feat_program = true where id in ($1, $2)`, [alice, bob]);
});

describe("form checks (102)", () => {
  it("client can tag a video to their own exercise, not someone else's", async () => {
    const w = (await q(`insert into workouts (athlete_id, workout_date, title, created_by) values ($1, sydney_today(), 'Legs', $2) returning id`, [alice, coach])).rows[0].id;
    const item = (await q(`insert into workout_items (workout_id, kind, exercise_id, position, sets, reps) values ($1, 'exercise', (select id from exercises limit 1), 1, 3, '5') returning id`, [w])).rows[0].id;
    const send = (who: string, kind = "video") =>
      asUser(db, who, () => q(`insert into messages (athlete_id, body, attachment_path, attachment_kind, form_check_item, form_check_set) values ($1::uuid, 'Form check', $1::text || '/x.mp4', $2, $3::uuid, 2) returning id`, [who, kind, item]));
    expect((await send(alice)).rows).toHaveLength(1);
    await expect(send(bob)).rejects.toThrow(/program/);
    await expect(send(alice, "image")).rejects.toThrow(/video/);
  });
});
