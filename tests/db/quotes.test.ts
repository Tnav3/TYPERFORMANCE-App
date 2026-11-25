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

describe("quotes (073)", () => {
  it("clients read active quotes only and can't write", async () => {
    await asUser(db, coach, () => q(`update quotes set active = false where author = 'Wayne Gretzky'`));
    const r = await asUser(db, alice, () => q(`select count(*)::int n from quotes`));
    expect(r.rows[0].n).toBe(6);
    await expect(asUser(db, alice, () => q(`insert into quotes (body) values ('hello there')`))).rejects.toThrow();
  });
});
