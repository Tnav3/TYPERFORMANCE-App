import { describe, it, expect } from "vitest";
import { freshDb, signUp } from "./harness";

describe("GHL invites carry a plan (089)", () => {
  it("a paid invite's plan lands on the new profile", async () => {
    const db = await freshDb();
    const k = await db.query<{ key: string }>(`select key from coaching_plans limit 1`);
    if (!k.rows.length) await db.query(`insert into coaching_plans (key, name) values ('performance', 'Performance')`);
    const key = k.rows[0]?.key ?? "performance";
    await db.query(`insert into invites (email, plan_key, auto_approve) values ('paid@typ.test', $1, true)`, [key]);
    const id = await signUp(db, "paid@typ.test", "Paid");
    const p = await db.query<{ plan_key: string; status: string }>(`select plan_key, status::text from profiles where id = $1`, [id]);
    expect(p.rows[0]).toEqual({ plan_key: key, status: "active" });
  });
});
