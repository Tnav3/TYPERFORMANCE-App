import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, prog: string, product: string;
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);
beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Coach");
  alice = await signUp(db, "alice@typ.test", "Alice");
  await makeCoach(db, "coach@typ.test");
  prog = (await q(`insert into programs (name, weeks) values ('Power Puncher', 2) returning id`)).rows[0].id as string;
  for (const [w, d] of [[1, 1], [1, 3], [2, 1]]) {
    const day = (await q(`insert into program_days (program_id, week_no, day_no, title) values ($1, $2, $3, 'Day') returning id`, [prog, w, d])).rows[0].id;
    await q(`insert into program_items (day_id, position, kind, title) values ($1, 1, 'text', 'Warm up')`, [day]);
  }
  product = (await q(`insert into shop_products (program_id, slug, title, price_cents, match_name, start_rule, active) values ($1, 'power-puncher', 'Power Puncher', 1499, 'Power Puncher', 'purchase', true) returning id`, [prog])).rows[0].id as string;
});

describe("program shop (098)", () => {
  it("existing client: activated, off hold, program assigned once", async () => {
    await q(`update profiles set status = 'inactive', payment_hold = true where id = $1`, [alice]);
    const pur = (await q(`insert into shop_purchases (product_id, email) values ($1, 'alice@typ.test') returning id`, [product])).rows[0].id;
    expect((await q(`select fulfil_shop_purchase($1) r`, [pur])).rows[0].r).toMatch(/assigned/);
    expect((await q(`select fulfil_shop_purchase($1) r`, [pur])).rows[0].r).toBe("already fulfilled");
    const p = (await q(`select status, payment_hold from profiles where id = $1`, [alice])).rows[0];
    expect(p).toEqual({ status: "active", payment_hold: false });
    expect((await q(`select count(*)::int n from workouts where athlete_id = $1`, [alice])).rows[0].n).toBe(3);
    expect((await q(`select count(*)::int n from workout_items wi join workouts w on w.id = wi.workout_id where w.athlete_id = $1`, [alice])).rows[0].n).toBe(3);
  });
  it("new buyer: invite now, program on signup, auto-approved", async () => {
    await q(`insert into shop_purchases (product_id, email) values ($1, 'new@typ.test')`, [product]);
    const pur = (await q(`select id from shop_purchases where email = 'new@typ.test'`)).rows[0].id;
    expect((await q(`select fulfil_shop_purchase($1) r`, [pur])).rows[0].r).toMatch(/invite/);
    const id = await signUp(db, "new@typ.test", "New Buyer");
    expect((await q(`select status from profiles where id = $1`, [id])).rows[0].status).toBe("active");
    expect((await q(`select count(*)::int n from workouts where athlete_id = $1`, [id])).rows[0].n).toBe(3);
    expect((await q(`select status from shop_purchases where id = $1`, [pur])).rows[0].status).toBe("fulfilled");
  });
  it("only active products are public; clients can't call fulfil or see purchases", async () => {
    await q(`insert into shop_products (program_id, slug, title, price_cents) values ($1, 'hidden-one', 'Hidden', 100)`, [prog]);
    expect((await asUser(db, null, () => q(`select slug from shop_products order by slug`))).rows.map((r) => r.slug)).toEqual(["power-puncher"]);
    expect((await asUser(db, coach, () => q(`select count(*)::int n from shop_products`))).rows[0].n).toBe(2);
    await q(`update profiles set status = 'active' where id = $1`, [alice]);
    await expect(asUser(db, alice, () => q(`select fulfil_shop_purchase(gen_random_uuid())`))).rejects.toThrow(/permission|Not allowed/);
    await expect(asUser(db, alice, () => q(`insert into shop_products (program_id, slug, title, price_cents) values ($1, 'mine', 'Mine', 1)`, [prog]))).rejects.toThrow();
  });
  it("trial product gives only the first week, and the trial-ending automation finds them until they buy", async () => {
    const trial = (await q(`insert into shop_products (program_id, slug, title, price_cents, start_rule, trial_days, active) values ($1, 'pp-free-week', 'Power Puncher Free Week', 0, 'purchase', 7, true) returning id`, [prog])).rows[0].id;
    const pur = (await q(`insert into shop_purchases (product_id, email) values ($1, 'alice@typ.test') returning id`, [trial])).rows[0].id;
    expect((await q(`select fulfil_shop_purchase($1) r`, [pur])).rows[0].r).toMatch(/^trial assigned/);
    expect((await q(`select count(*)::int n from workouts where athlete_id = $1`, [alice])).rows[0].n).toBe(2);
    const auto = (await q(`insert into automations (created_by, name, trigger, threshold, audience, body, active) values ($1, 'Trial', 'trial_ending', 7, 'client', 'Hi', true) returning *`, [coach])).rows[0];
    const hits = async () => (await q(`select count(*)::int n from private.automation_matches((select a from automations a where id = $1), sydney_today())`, [auto.id])).rows[0].n;
    expect(await hits()).toBe(1);
    const full = (await q(`insert into shop_purchases (product_id, email) values ($1, 'alice@typ.test') returning id`, [product])).rows[0].id;
    await q(`select fulfil_shop_purchase($1)`, [full]);
    expect(await hits()).toBe(0);
  });
});
