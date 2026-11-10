import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);

beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Tyrell");
  alice = await signUp(db, "alice@typ.test", "Alice");
  bob = await signUp(db, "bob@typ.test", "Bob");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id in ($1, $2)`, [alice, bob]);
});

describe("coach edits an athlete's profile", () => {
  it("coach can change another athlete's details", async () => {
    const r = await asUser(db, coach, () =>
      q(`update profiles set full_name = 'Alice Smith', weight_class = 'Lightweight', weight_class_limit_kg = 70.3, sex = 'female' where id = $1 returning id`, [alice]),
    );
    expect(r.rows).toHaveLength(1);
    const p = await q(`select full_name, sex from profiles where id = $1`, [alice]);
    expect(p.rows[0]).toEqual({ full_name: "Alice Smith", sex: "female" });
  });
  it("an athlete can't edit someone else (no rows touched)", async () => {
    const r = await asUser(db, bob, () => q(`update profiles set full_name = 'Hacked' where id = $1 returning id`, [alice]));
    expect(r.rows).toHaveLength(0);
  });
  it("the coach still can't change email through the app", async () => {
    await expect(
      asUser(db, coach, () => q(`update profiles set email = 'x@y.z' where id = $1`, [alice])),
    ).rejects.toThrow(/cannot be changed/);
  });
});
