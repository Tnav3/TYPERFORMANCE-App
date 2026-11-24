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
  await q(`update profiles set status = 'active', feat_chat = true where id in ($1, $2)`, [alice, bob]);
});

describe("chat media (061)", () => {
  it("a client sends a video with no text; the coach gets a readable notification", async () => {
    await asUser(db, alice, () =>
      q(`insert into messages (athlete_id, body, attachment_path, attachment_kind) values ($1, '', $2, 'video')`, [alice, `${alice}/clip.mp4`]),
    );
    const n = await q(`select body from notifications where user_id = $1`, [coach]);
    expect(n.rows[0].body).toBe("Sent a video");
  });
  it("needs text or a file; files must be in the thread's folder", async () => {
    await expect(asUser(db, alice, () => q(`insert into messages (athlete_id, body) values ($1, '  ')`, [alice]))).rejects.toThrow(/check/);
    await expect(
      asUser(db, alice, () => q(`insert into messages (athlete_id, body, attachment_path, attachment_kind) values ($1, '', $2, 'image')`, [alice, `${bob}/x.jpg`])),
    ).rejects.toThrow(/another chat/);
    await expect(asUser(db, alice, () => q(`insert into storage.objects (bucket_id, name) values ('chat-media', $1)`, [`${bob}/x.jpg`]))).rejects.toThrow(/row-level/);
  });
  it("reactions: one each, only on your own thread", async () => {
    const m = (await asUser(db, coach, () => q(`insert into messages (athlete_id, body) values ($1, 'Nice set') returning id`, [alice]))).rows[0].id;
    await asUser(db, alice, () => q(`insert into message_reactions (message_id, emoji) values ($1, '🔥')`, [m]));
    await expect(asUser(db, alice, () => q(`insert into message_reactions (message_id, emoji) values ($1, '👍')`, [m]))).rejects.toThrow(/duplicate/);
    await expect(asUser(db, bob, () => q(`insert into message_reactions (message_id, emoji) values ($1, '👍')`, [m]))).rejects.toThrow(/row-level/);
    expect((await asUser(db, bob, () => q(`select count(*)::int n from message_reactions`))).rows[0].n).toBe(0);
  });
});
