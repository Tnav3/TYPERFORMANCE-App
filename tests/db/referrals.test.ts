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

describe("referrals (050)", () => {
  it("a sign-up with a client's code is linked to them; others can't see it", async () => {
    const code = (await q(`select referral_code from profiles where id = $1`, [alice])).rows[0].referral_code as string;
    expect(code).toMatch(/^[0-9a-f]{8}$/);
    const bob = (
      await q(`insert into auth.users (email, raw_user_meta_data) values ('bob@typ.test', $1) returning id`, [JSON.stringify({ full_name: "Bob", ref: code.toUpperCase() })])
    ).rows[0].id;
    const mine = await asUser(db, alice, () => q(`select referred_id from referrals`));
    expect(mine.rows).toEqual([{ referred_id: bob }]);
    const theirs = await asUser(db, bob as string, () => q(`select count(*)::int n from referrals`));
    expect(theirs.rows[0].n).toBe(0);
    // a bad code is ignored, sign-up still works
    await q(`insert into auth.users (email, raw_user_meta_data) values ('carl@typ.test', '{"ref":"nope"}')`);
    expect((await asUser(db, coach, () => q(`select count(*)::int n from referrals`))).rows[0].n).toBe(1);
  });
  it("only the coach manages offers; clients see active ones", async () => {
    await asUser(db, coach, () => q(`insert into referral_offers (title, active) values ('Bring a mate', true), ('Old', false)`));
    const seen = await asUser(db, alice, () => q(`select title from referral_offers`));
    expect(seen.rows).toEqual([{ title: "Bring a mate" }]);
    await expect(asUser(db, alice, () => q(`insert into referral_offers (title) values ('Mine')`))).rejects.toThrow(/row-level/);
  });
});
