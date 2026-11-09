import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";
import { e1rmFrom } from "@/lib/testing";

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
  await q(`update profiles set status = 'active' where id in ($1, $2)`, [alice, bob]);
});

const save = (uid: string, athlete: string, lift: string, load: number, reps: number, bw: number | null = null, e1rm = 1) =>
  asUser(db, uid, () =>
    q(
      `insert into lift_maxes (athlete_id, lift_key, load_kg, reps, bodyweight_kg, e1rm_kg)
       values ($1, $2, $3, $4, $5, $6) returning e1rm_kg::float as e, entered_by, bodyweight_kg`,
      [athlete, lift, load, reps, bw, e1rm],
    ),
  );

describe("lift catalogue", () => {
  it("seeds the spec lift list incl. 4 loaded jumps with parents", async () => {
    const r = await q(`select key, parent_key from lifts where kind = 'jump' order by sort_order`);
    expect(r.rows).toEqual([
      { key: "trap_bar_jump", parent_key: "trap_bar_dl" },
      { key: "squat_jump", parent_key: "back_squat" },
      { key: "split_squat_jump", parent_key: "split_squat" },
      { key: "smith_bench_throw", parent_key: "bench" },
    ]);
    const n = await q(`select count(*)::int as n from lifts where kind <> 'jump'`);
    expect(n.rows[0].n).toBe(21);
  });
  it("coach can add a jump with a parent; athletes can't add lifts", async () => {
    await asUser(db, coach, () =>
      q(`insert into lifts (key, name, category, kind, parent_key) values ('hex_jump', 'Hex jump', 'jump', 'jump', 'trap_bar_dl')`),
    );
    await expect(
      asUser(db, alice, () =>
        q(`insert into lifts (key, name, category, kind) values ('x_lift', 'X', 'press', 'barbell')`),
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("a jump can't be the parent of a jump, and a jump must have a parent", async () => {
    await expect(
      asUser(db, coach, () =>
        q(`insert into lifts (key, name, category, kind, parent_key) values ('j2', 'J2', 'jump', 'jump', 'squat_jump')`),
      ),
    ).rejects.toThrow(/own 1RM/);
    await expect(
      asUser(db, coach, () => q(`insert into lifts (key, name, category, kind) values ('j3', 'J3', 'jump', 'jump')`)),
    ).rejects.toThrow(/check/);
  });
  it("the app can't set or change the research bar-speed model", async () => {
    await asUser(db, coach, () =>
      q(`insert into lifts (key, name, category, kind, velocity_model) values ('pin_press', 'Pin press', 'press', 'barbell', 'bench')`),
    );
    await asUser(db, coach, () => q(`update lifts set velocity_model = null, name = 'Bench' where key = 'bench'`));
    const r = await q(`select key, velocity_model, name from lifts where key in ('pin_press', 'bench') order by key`);
    expect(r.rows).toEqual([
      { key: "bench", velocity_model: "bench", name: "Bench" },
      { key: "pin_press", velocity_model: null, name: "Pin press" },
    ]);
  });
});

describe("saved e1RMs", () => {
  it("computes e1RM in the database (typed value ignored) and matches the app", async () => {
    for (const [load, reps] of [[100, 1], [100, 3], [100, 5], [87.5, 7], [142.5, 10], [61, 2]] as const) {
      const r = await save(alice, alice, "bench", load, reps, null, 999);
      expect(r.rows[0].e).toBe(e1rmFrom(load, reps));
    }
  });
  it("bodyweight lifts store system e1RM and require bodyweight", async () => {
    const r = await save(alice, alice, "weighted_chin_up", 20, 5, 75);
    expect(r.rows[0].e).toBe(e1rmFrom(95, 5));
    await expect(save(alice, alice, "weighted_pull_up", 20, 5)).rejects.toThrow(/Bodyweight/);
  });
  it("bodyweight is dropped for barbell lifts", async () => {
    const r = await save(alice, alice, "bench", 100, 3, 80);
    expect(r.rows[0].bodyweight_kg).toBeNull();
  });
  it("jumps can't be saved; reps capped at 10", async () => {
    await expect(save(alice, alice, "squat_jump", 40, 3)).rejects.toThrow(/parent/);
    await expect(save(alice, alice, "bench", 60, 11)).rejects.toThrow(/check/);
  });
  it("athletes save only their own; pending can't; coach can for anyone", async () => {
    await expect(save(alice, bob, "bench", 100, 3)).rejects.toThrow(/row-level security/);
    await expect(save(pending, pending, "bench", 100, 3)).rejects.toThrow(/row-level security/);
    const r = await save(coach, bob, "bench", 100, 3);
    expect(r.rows[0].entered_by).toBe(coach);
  });
  it("athletes see only their own; coach sees all; no updates", async () => {
    await save(alice, alice, "bench", 100, 3);
    await save(bob, bob, "deadlift", 180, 3);
    const a = await asUser(db, alice, () => q(`select lift_key from lift_maxes`));
    expect(a.rows).toEqual([{ lift_key: "bench" }]);
    const c = await asUser(db, coach, () => q(`select count(*)::int as n from lift_maxes`));
    expect(c.rows[0].n).toBe(2);
    const u = await asUser(db, alice, () => q(`update lift_maxes set e1rm_kg = 500 returning id`));
    expect(u.rows).toHaveLength(0);
  });
  it("athletes delete only their own", async () => {
    await save(bob, bob, "deadlift", 180, 3);
    const d = await asUser(db, alice, () => q(`delete from lift_maxes returning id`));
    expect(d.rows).toHaveLength(0);
    const d2 = await asUser(db, bob, () => q(`delete from lift_maxes returning id`));
    expect(d2.rows).toHaveLength(1);
  });
});

describe("bike MAS test definition (migration 009)", () => {
  it("sits right after the run test with no duplicate field order", async () => {
    const r = await q(`select key, name, sort_order from test_definitions where mode = 'field' order by sort_order`);
    const keys = r.rows.map((x) => x.key);
    expect(keys.indexOf("mas_bike_5min")).toBe(keys.indexOf("mas_5min") + 1);
    expect(new Set(r.rows.map((x) => x.sort_order)).size).toBe(r.rows.length);
    expect(r.rows.find((x) => x.key === "mas_5min")!.name).toBe("5-minute MAS test (run)");
  });
});

describe("rower + SkiErg MAS tests (migration 010)", () => {
  it("follow the bike test in order", async () => {
    const r = await q(`select key from test_definitions where mode = 'field' order by sort_order`);
    const k = r.rows.map((x) => x.key);
    expect(k.slice(k.indexOf("mas_5min"), k.indexOf("mas_5min") + 4)).toEqual([
      "mas_5min", "mas_bike_5min", "mas_row_5min", "mas_ski_5min",
    ]);
  });
});

describe("test categories + Wingate (migration 011)", () => {
  it("every field test has a category; ForceDecks has none", async () => {
    const r = await q(`select mode, category, count(*)::int as n from test_definitions group by 1, 2 order by 1, 2`);
    expect(r.rows).toEqual([
      { mode: "field", category: "conditioning", n: 5 },
      { mode: "field", category: "power", n: 4 },
      { mode: "field", category: "strength", n: 4 },
      { mode: "forcedecks", category: null, n: 6 },
    ]);
  });
  it("categories are limited to the three groups", async () => {
    await expect(q(`update test_definitions set category = 'speed' where key = 'chin_ups'`)).rejects.toThrow(/check/);
  });
});
