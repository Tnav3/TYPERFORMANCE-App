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

describe("client blocks (070)", () => {
  it("creates a block straight on the client, then imports it to another client", async () => {
    const a = (await asUser(db, coach, () => q(`select create_client_block($1, 'Strength 1', '2026-11-30', 2, array[1,3,5]) id`, [alice]))).rows[0].id as string;
    const ws = await q(`select workout_date::text d, title from workouts where assignment_id = $1 order by workout_date`, [a]);
    expect(ws.rows.map((r) => r.d)).toEqual(["2026-11-30", "2026-12-02", "2026-12-04", "2026-12-07", "2026-12-09", "2026-12-11"]);
    expect(ws.rows[0].title).toBe("Strength 1 · W1 Mon");
    const first = (await q(`select id from workouts where assignment_id = $1 order by workout_date limit 1`, [a])).rows[0].id;
    const ex = (await q(`select id from exercises limit 1`)).rows[0].id;
    await q(`insert into workout_items (workout_id, kind, exercise_id, position, sets, reps) values ($1, 'exercise', $2, 1, 3, '5')`, [first, ex]);
    const b = (await asUser(db, coach, () => q(`select copy_assignment_to($1, $2, '2026-12-14') id`, [a, bob]))).rows[0].id;
    const copied = await q(`select w.workout_date::text d, count(i.*)::int n from workouts w left join workout_items i on i.workout_id = w.id where w.assignment_id = $1 group by 1 order by 1 limit 2`, [b]);
    expect(copied.rows).toEqual([{ d: "2026-12-14", n: 1 }, { d: "2026-12-16", n: 0 }]);
  });
  it("coach only", async () => {
    await expect(asUser(db, alice, () => q(`select create_client_block($1, 'X block', '2026-11-30', 1, array[1])`, [alice]))).rejects.toThrow(/Coach only/);
  });
});
