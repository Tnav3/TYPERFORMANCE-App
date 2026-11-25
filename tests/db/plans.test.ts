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
});

describe("coaching plans (069)", () => {
  it("coach sets a client's plan and booking link; client reads it but can't change it", async () => {
    await asUser(db, coach, async () => {
      await q(`update coaching_plans set booking_url = 'https://calendly.com/typerformance/check-in' where key = 'elite'`);
      await q(`update profiles set plan_key = 'elite' where id = $1`, [alice]);
    });
    const r = await asUser(db, alice, () => q(`select c.booking_url, c.cadence from profiles p join coaching_plans c on c.key = p.plan_key where p.id = $1`, [alice]));
    expect(r.rows[0]).toEqual({ booking_url: "https://calendly.com/typerformance/check-in", cadence: "weekly" });
    await expect(asUser(db, alice, () => q(`update profiles set plan_key = 'foundation' where id = $1`, [alice]))).rejects.toThrow(/coach/);
    await expect(asUser(db, coach, () => q(`update coaching_plans set booking_url = 'javascript:alert(1)' where key = 'elite'`))).rejects.toThrow(/check/);
  });
});
