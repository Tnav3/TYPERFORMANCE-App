import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);
beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Coach");
  alice = await signUp(db, "alice@typ.test", "Alice");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active', feat_program = true where id = $1`, [alice]);
});

describe("coach reactions on logs (097)", () => {
  it("coach reacts, client is notified once; client can't set it", async () => {
    const w = (await q(`insert into workouts (athlete_id, workout_date, title, created_by) values ($1, sydney_today(), 'Legs', $2) returning id`, [alice, coach])).rows[0].id;
    const log = (await asUser(db, alice, () => q(`insert into workout_logs (workout_id, athlete_id, workout_date, coach_reaction) values ($1, $2, sydney_today(), '🔥') returning id, coach_reaction`, [w, alice]))).rows[0];
    expect(log.coach_reaction).toBeNull();
    await asUser(db, coach, () => q(`update workout_logs set coach_reaction = '💪', coach_reacted_at = now() where id = $1`, [log.id]));
    await asUser(db, coach, () => q(`update workout_logs set coach_reaction = '💪' where id = $1`, [log.id]));
    expect((await q(`select count(*)::int n from notifications where user_id = $1 and title = 'Your coach reacted 💪'`, [alice])).rows[0].n).toBe(1);
    await asUser(db, alice, () => q(`update workout_logs set coach_reaction = '👍' where id = $1`, [log.id]));
    expect((await q(`select coach_reaction from workout_logs where id = $1`, [log.id])).rows[0].coach_reaction).toBe("💪");
    await expect(asUser(db, coach, () => q(`update workout_logs set coach_reaction = '💩' where id = $1`, [log.id]))).rejects.toThrow();
  });
});
