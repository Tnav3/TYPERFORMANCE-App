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
  await q(`update profiles set status = 'active' where id = $1`, [alice]);
});

describe("program folders (059)", () => {
  it("ships starter folders with subfolders", async () => {
    const r = await asUser(db, coach, () => q(`select c.name from program_folders c join program_folders p on p.id = c.parent_id where p.name = 'Protocols' order by c.sort_order`));
    expect(r.rows.map((x) => x.name)).toEqual(["Injury & rehab", "Hot/cold contrast", "Recovery"]);
  });
  it("blocks loops and deep nesting; deleting keeps programs", async () => {
    await asUser(db, coach, async () => {
      const a = (await q(`insert into program_folders (name) values ('A') returning id`)).rows[0].id;
      const b = (await q(`insert into program_folders (name, parent_id) values ('B', $1) returning id`, [a])).rows[0].id;
      await expect(q(`update program_folders set parent_id = $1 where id = $2`, [b, a])).rejects.toThrow(/inside itself/);
      const c = (await q(`insert into program_folders (name, parent_id) values ('C', $1) returning id`, [b])).rows[0].id;
      const d = (await q(`insert into program_folders (name, parent_id) values ('D', $1) returning id`, [c])).rows[0].id;
      await expect(q(`insert into program_folders (name, parent_id) values ('E', $1)`, [d])).rejects.toThrow(/4 levels/);
      const p = (await q(`insert into programs (name, folder_id) values ('Rehab', $1) returning id`, [d])).rows[0].id;
      await q(`delete from program_folders where id = $1`, [a]);
      expect((await q(`select folder_id from programs where id = $1`, [p])).rows[0].folder_id).toBeNull();
    });
  });
  it("clients can't see folders", async () => {
    expect((await asUser(db, alice, () => q(`select count(*)::int n from program_folders`))).rows[0].n).toBe(0);
  });
});
