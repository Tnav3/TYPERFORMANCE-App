import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string, pending: string;
const q = (sql: string, params: unknown[] = []) =>
  db.query<Record<string, unknown>>(sql, params);

beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Tyrell");
  alice = await signUp(db, "alice@typ.test", "Alice");
  bob = await signUp(db, "bob@typ.test", "Bob");
  pending = await signUp(db, "pend@typ.test", "Pending");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id in ($1, $2)`, [
    alice,
    bob,
  ]);
});

const entry = (
  uid: string,
  key: string,
  athlete: string,
  extra: { date?: string; video?: string } = {},
) =>
  asUser(db, uid, () =>
    q(
      `insert into test_entries (athlete_id, test_key, tested_on, values, video_path)
       values ($1, $2, coalesce($3::date, sydney_today()), '{"x": 1}', $4) returning id, entered_by`,
      [athlete, key, extra.date ?? null, extra.video ?? null],
    ),
  );

describe("test definitions", () => {
  it("has 13 field tests grouped Power → Strength → Conditioning, and the 6 ForceDecks tests in your battery order", async () => {
    const f = await q(
      `select key from test_definitions where mode = 'field' order by sort_order`,
    );
    expect(f.rows.map((r) => r.key)).toEqual([
      "med_ball_throw",
      "broad_jump",
      "single_hop",
      "triple_hop",
      "lateral_bound",
      "trap_bar_3rm",
      "box_squat_3rm",
      "bench_3rm",
      "chin_ups",
      "mas_5min",
      "mas_bike_5min",
      "mas_row_5min",
      "mas_ski_5min",
      "wingate_30s",
    ]);
    const fd = await q(
      `select key from test_definitions where mode = 'forcedecks' order by sort_order`,
    );
    expect(fd.rows.map((r) => r.key)).toEqual([
      "cmj",
      "slj",
      "sl_iso_squat",
      "imtp",
      "plyo_pushup",
      "rj_10_5",
    ]);
  });
  it("coach can edit video + instructions; athletes can't", async () => {
    await asUser(db, coach, () =>
      q(
        `update test_definitions set youtube_url = 'https://youtu.be/abc' where key = 'cmj'`,
      ),
    );
    expect(
      (await q(`select youtube_url from test_definitions where key = 'cmj'`))
        .rows[0].youtube_url,
    ).toBe("https://youtu.be/abc");
    const r = await asUser(db, alice, () =>
      q(`update test_definitions set instructions = 'hacked'`),
    );
    expect(r.affectedRows).toBe(0);
  });
});

describe("test entries", () => {
  it("athlete enters own field tests; entered_by is forced to the real user", async () => {
    const r = await entry(alice, "broad_jump", alice);
    expect(r.rows[0].entered_by).toBe(alice);
  });
  it("athlete cannot enter ForceDecks results (coach only)", async () => {
    await expect(entry(alice, "cmj", alice)).rejects.toThrow(
      /row-level security/,
    );
    await expect(entry(coach, "cmj", alice)).resolves.toBeTruthy();
  });
  it("athlete cannot enter for someone else; pending can't enter", async () => {
    await expect(entry(alice, "broad_jump", bob)).rejects.toThrow(
      /row-level security/,
    );
    await expect(entry(pending, "broad_jump", pending)).rejects.toThrow(
      /row-level security/,
    );
  });
  it("coach can enter field tests for an athlete too", async () => {
    const r = await entry(coach, "bench_3rm", alice);
    expect(r.rows[0].entered_by).toBe(coach);
  });
  it("no future test dates", async () => {
    await expect(
      asUser(db, alice, () =>
        q(
          `insert into test_entries (test_key, tested_on, values) values ('broad_jump', sydney_today() + 1, '{}')`,
        ),
      ),
    ).rejects.toThrow(/future/);
  });
  it("privacy: athletes see only their own; coach sees all", async () => {
    await entry(alice, "broad_jump", alice);
    await entry(bob, "broad_jump", bob);
    expect(
      (
        await asUser(db, alice, () =>
          q(`select count(*)::int n from test_entries`),
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await asUser(db, coach, () =>
          q(`select count(*)::int n from test_entries`),
        )
      ).rows[0].n,
    ).toBe(2);
  });
  it("athlete can delete own field entry but not ForceDecks ones or others'", async () => {
    const own = (await entry(alice, "broad_jump", alice)).rows[0].id;
    const fd = (await entry(coach, "cmj", alice)).rows[0].id;
    const bobs = (await entry(bob, "broad_jump", bob)).rows[0].id;
    for (const [id, n] of [
      [own, 1],
      [fd, 0],
      [bobs, 0],
    ] as const) {
      const r = await asUser(db, alice, () =>
        q(`delete from test_entries where id = $1`, [id]),
      );
      expect(r.affectedRows).toBe(n);
    }
  });
  it("video path must be in the athlete's own folder", async () => {
    await expect(
      entry(alice, "broad_jump", alice, { video: `${bob}/clip.mp4` }),
    ).rejects.toThrow(/folder/);
    await expect(
      entry(alice, "broad_jump", alice, { video: `${alice}/clip.mp4` }),
    ).resolves.toBeTruthy();
  });
});

describe("test video storage", () => {
  const upload = (uid: string, path: string) =>
    asUser(db, uid, () =>
      q(
        `insert into storage.objects (bucket_id, name) values ('test-videos', $1)`,
        [path],
      ),
    );

  it("bucket is private with a 50 MB limit and video types only", async () => {
    const b = (
      await q(
        `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'test-videos'`,
      )
    ).rows[0];
    expect(b.public).toBe(false);
    expect(Number(b.file_size_limit)).toBe(52428800);
    expect(b.allowed_mime_types).toContain("video/quicktime");
  });
  it("athletes upload only into their own folder; pending can't upload", async () => {
    await expect(upload(alice, `${alice}/a.mp4`)).resolves.toBeTruthy();
    await expect(upload(alice, `${bob}/a.mp4`)).rejects.toThrow(
      /row-level security/,
    );
    await expect(upload(pending, `${pending}/a.mp4`)).rejects.toThrow(
      /row-level security/,
    );
  });
  it("athletes see only their own clips; coach sees all and can delete", async () => {
    await upload(alice, `${alice}/a.mp4`);
    await upload(bob, `${bob}/b.mp4`);
    expect(
      (
        await asUser(db, alice, () => q(`select name from storage.objects`))
      ).rows.map((r) => r.name),
    ).toEqual([`${alice}/a.mp4`]);
    expect(
      (
        await asUser(db, coach, () =>
          q(`select count(*)::int n from storage.objects`),
        )
      ).rows[0].n,
    ).toBe(2);
    const d = await asUser(db, coach, () =>
      q(`delete from storage.objects where name = $1`, [`${bob}/b.mp4`]),
    );
    expect(d.affectedRows).toBe(1);
  });
});
