import { describe, it, expect } from "vitest";
import { freshDb } from "./harness";

describe("band + resistance fields (079)", () => {
  it("accepts the new fields and still rejects unknown ones", async () => {
    const db = await freshDb();
    const ex = await db.query<{ id: string }>(`select id from exercises limit 1`);
    await db.query(`update exercises set fields = array['reps','band'] where id = $1`, [ex.rows[0].id]);
    await db.query(`update exercises set fields = array['resistance','watts'] where id = $1`, [ex.rows[0].id]);
    await expect(db.query(`update exercises set fields = array['nope'] where id = $1`, [ex.rows[0].id])).rejects.toThrow();
    const p = await db.query<{ id: string }>(`insert into programs (name) values ('Band test') returning id`);
    const d = await db.query<{ id: string }>(`insert into program_days (program_id, week_no, day_no) values ($1,1,1) returning id`, [p.rows[0].id]);
    await db.query(`insert into program_items (day_id, position, kind, exercise_id, block, slot, fields) values ($1,1,'exercise',$2,'A',1,array['reps','band'])`, [d.rows[0].id, ex.rows[0].id]);
  });
});
