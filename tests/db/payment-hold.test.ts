import { describe, it, expect } from "vitest";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

describe("payment hold (091)", () => {
  it("only the coach can put a client on hold or release them", async () => {
    const db = await freshDb();
    const coach = await signUp(db, "coach@typ.test", "Coach");
    const alice = await signUp(db, "alice@typ.test", "Alice");
    await makeCoach(db, "coach@typ.test");
    await db.query(`update profiles set status = 'active' where id = $1`, [alice]);
    await asUser(db, coach, () => db.query(`update profiles set payment_hold = true where id = $1`, [alice]));
    await expect(asUser(db, alice, () => db.query(`update profiles set payment_hold = false where id = $1`, [alice]))).rejects.toThrow(/coach/);
    // the client can still message while on hold
    await asUser(db, alice, () => db.query(`insert into messages (athlete_id, sender_id, body) values ($1, $1, 'Card got declined, will fix tonight')`, [alice]));
    expect((await db.query<{ n: number }>(`select count(*)::int n from messages where athlete_id = $1`, [alice])).rows[0].n).toBe(1);
  });
});
