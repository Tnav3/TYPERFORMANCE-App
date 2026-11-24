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
  await q(`update profiles set status = 'active' where id in ($1, $2)`, [alice, bob]);
});

describe("profile personality (055)", () => {
  it("clients set their own nickname, goal, about and photo", async () => {
    await asUser(db, alice, () =>
      q(`update profiles set nickname = 'The Hammer', goal_text = 'Win state title', about_me = 'Muay Thai since 2019', avatar_path = $2 where id = $1`, [alice, `${alice}/a1.jpg`]),
    );
    const r = await q(`select nickname, goal_text, avatar_path from profiles where id = $1`, [alice]);
    expect(r.rows[0]).toEqual({ nickname: "The Hammer", goal_text: "Win state title", avatar_path: `${alice}/a1.jpg` });
  });
  it("a photo must be in the person's own folder", async () => {
    await expect(asUser(db, alice, () => q(`update profiles set avatar_path = $2 where id = $1`, [alice, `${bob}/x.jpg`]))).rejects.toThrow(/someone else/);
    await expect(asUser(db, alice, () => q(`update profiles set avatar_path = '../x.jpg' where id = $1`, [alice]))).rejects.toThrow(/someone else|check/);
  });
  it("clients can't upload into another folder", async () => {
    await expect(asUser(db, alice, () => q(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${bob}/x.jpg`]))).rejects.toThrow(/row-level/);
    await asUser(db, alice, () => q(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${alice}/x.jpg`]));
    await asUser(db, coach, () => q(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${bob}/y.jpg`]));
  });
});
