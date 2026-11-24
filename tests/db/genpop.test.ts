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
  await q(`update profiles set status = 'active', feat_habits = true, feat_macros = true, feat_photos = true where id in ($1, $2)`, [alice, bob]);
});

describe("habits (040)", () => {
  it("coach sets habits; client ticks own, last 7 days only", async () => {
    const h = await asUser(db, coach, () => q(`insert into habits (athlete_id, name) values ($1, '8k steps') returning id`, [alice]));
    await asUser(db, alice, () => q(`insert into habit_logs (habit_id) values ($1)`, [h.rows[0].id]));
    await expect(
      asUser(db, alice, () => q(`insert into habit_logs (habit_id, day) values ($1, sydney_today() - 10)`, [h.rows[0].id])),
    ).rejects.toThrow(/last 7 days/);
    await expect(asUser(db, bob, () => q(`insert into habit_logs (habit_id) values ($1)`, [h.rows[0].id]))).rejects.toThrow(/not yours/);
    await expect(asUser(db, alice, () => q(`insert into habits (athlete_id, name) values ($1, 'mine')`, [alice]))).rejects.toThrow(/row-level/);
  });
  it("switched off blocks ticking", async () => {
    const h = await asUser(db, coach, () => q(`insert into habits (athlete_id, name) values ($1, 'Water') returning id`, [alice]));
    await q(`update profiles set feat_habits = false where id = $1`, [alice]);
    await expect(asUser(db, alice, () => q(`insert into habit_logs (habit_id) values ($1)`, [h.rows[0].id]))).rejects.toThrow(/switched off/);
  });
});

describe("macros and photos (040)", () => {
  it("targets are coach-set; client logs daily totals", async () => {
    await asUser(db, coach, () => q(`insert into macro_targets (athlete_id, calories, protein_g) values ($1, 2200, 160)`, [alice]));
    await expect(asUser(db, alice, () => q(`update macro_targets set calories = 4000`))).resolves.toMatchObject({ affectedRows: 0 });
    await asUser(db, alice, () => q(`insert into macro_logs (calories, protein_g) values (2100, 150)`));
    const b = await asUser(db, bob, () => q(`select count(*)::int n from macro_logs`));
    expect(b.rows[0].n).toBe(0);
  });
  it("photos must sit in the client's own folder", async () => {
    await asUser(db, alice, () => q(`insert into progress_photos (pose, path) values ('front', $1)`, [`${alice}/a.jpg`]));
    await expect(
      asUser(db, alice, () => q(`insert into progress_photos (pose, path) values ('front', $1)`, [`${bob}/a.jpg`])),
    ).rejects.toThrow(/check/);
    const b = await asUser(db, bob, () => q(`select count(*)::int n from progress_photos`));
    expect(b.rows[0].n).toBe(0);
  });
});

describe("invites (041)", () => {
  it("an invited email starts approved with the plan's features", async () => {
    await asUser(db, coach, () => q(`insert into invites (email, plan) values ('vip@typ.test', 'premium')`));
    const id = await signUp(db, "VIP@typ.test", "Vip");
    const p = await q(`select status, feat_mealplan from profiles where id = $1`, [id]);
    expect(p.rows[0]).toEqual({ status: "active", feat_mealplan: true });
    const other = await signUp(db, "walkin@typ.test", "Walk");
    const o = await q(`select status, feat_mealplan from profiles where id = $1`, [other]);
    expect(o.rows[0]).toEqual({ status: "pending", feat_mealplan: false });
    const inv = await asUser(db, alice, () => q(`select count(*)::int n from invites`));
    expect(inv.rows[0].n).toBe(0);
  });
});
