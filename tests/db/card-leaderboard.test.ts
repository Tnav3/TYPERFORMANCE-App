import { describe, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

async function people(db: PGlite, n: number) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = await signUp(db, `a${i}@typ.test`, `Athlete${i} Smith`);
    ids.push(id);
  }
  await db.query(`update profiles set status = 'active' where id = any($1)`, [ids]);
  return ids;
}
const board = (db: PGlite, id: string) => asUser(db, id, () => db.query<{ b: Record<string, unknown> }>(`select public.card_leaderboard() b`)).then((r) => r.rows[0].b);

describe("card leaderboard (092)", () => {
  it("stays closed under 8 people and never reveals the head count", async () => {
    const db = await freshDb();
    const ids = await people(db, 7);
    for (const [i, id] of ids.entries()) {
      await asUser(db, id, () => db.query(`select public.set_card_on_board(true)`));
      await db.query(`update player_cards set overall = $2, tier = 'silver' where athlete_id = $1`, [id, 60 + i]);
    }
    const b = await board(db, ids[0]);
    expect(b).toEqual({ open: false, me_on: true });
  });

  it("opens at 8: top 10, movers, coarse percentile, opted-out and held clients excluded", async () => {
    const db = await freshDb();
    const coach = await signUp(db, "coach@typ.test", "Coach");
    await makeCoach(db, "coach@typ.test");
    const ids = await people(db, 10);
    for (const [i, id] of ids.entries()) {
      await asUser(db, id, () => db.query(`select public.set_card_on_board($1)`, [i !== 9])); // #9 opts out
      await db.query(`update player_cards set overall = $2, tier = 'silver', month_base = $3 where athlete_id = $1`, [id, 60 + i, 60 + i - (i % 3)]);
    }
    await db.query(`update profiles set payment_hold = true where id = $1`, [ids[8]]); // on hold: hidden
    // 8 visible (0..7)
    const b = await board(db, ids[0]) as { open: boolean; my_top_pct: number; top: { name: string; overall: number }[]; movers: { gain: number }[] };
    expect(b.open).toBe(true);
    expect(b.top).toHaveLength(8);
    expect(b.top[0].overall).toBe(67);
    expect(b.top[0].name).toBe("Athlete7 S.");
    expect(b.my_top_pct).toBe(100); // last of 8 → bottom bucket, no exact count
    expect(b.movers.every((m) => m.gain > 0)).toBe(true);
    expect(JSON.stringify(b)).not.toMatch(/"n"|count|total/);
    // coach can see it too
    expect(((await board(db, coach)) as { open: boolean }).open).toBe(true);
    // a client can't switch someone else on
    await expect(asUser(db, ids[1], () => db.query(`update player_cards set on_board = true where athlete_id = $1`, [ids[9]]))).resolves.toBeTruthy();
    expect((await db.query<{ on_board: boolean }>(`select on_board from player_cards where athlete_id = $1`, [ids[9]])).rows[0].on_board).toBe(false);
  });
});
