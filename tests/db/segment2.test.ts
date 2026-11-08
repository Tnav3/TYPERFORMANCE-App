import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string, pending: string;
let mt: string, bag: string, boxing: string, boxingPads: string;

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
  const ids = await q(`
    select d.name as d, s.name as s, d.id as did, s.id as sid
    from session_types s join disciplines d on d.id = s.discipline_id
    where (d.name, s.name) in (('Muay Thai','Bag work'), ('Boxing','Pad work'))`);
  for (const r of ids.rows) {
    if (r.d === "Muay Thai") {
      mt = r.did as string;
      bag = r.sid as string;
    } else {
      boxing = r.did as string;
      boxingPads = r.sid as string;
    }
  }
});

// Inserts a session `daysAgo` days before Sydney-today
const addSession = (
  uid: string,
  daysAgo: number,
  opts: { d?: string; s?: string; rpe?: number; min?: number } = {},
) =>
  asUser(db, uid, () =>
    q(
      `insert into training_sessions (session_date, start_time, duration_min, discipline_id, session_type_id, rpe)
       values (sydney_today() - $1::int, '18:00', $2, $3, $4, $5) returning id, load_au, week_start, session_date`,
      [daysAgo, opts.min ?? 60, opts.d ?? mt, opts.s ?? bag, opts.rpe ?? 7],
    ),
  );

describe("sessions", () => {
  it("load = RPE × minutes, week_start = that week's Monday", async () => {
    const r = await addSession(alice, 0, { rpe: 7, min: 90 });
    expect(r.rows[0].load_au).toBe(630);
    const chk = await q(
      `select extract(isodow from week_start)::int as dow, week_start <= session_date and session_date - week_start < 7 as inweek from training_sessions`,
    );
    expect(chk.rows[0]).toEqual({ dow: 1, inweek: true });
  });

  it("week_monday matches known dates (Sun → previous Mon)", async () => {
    const r = await q(
      `select week_monday('2026-11-08')::text as sun, week_monday('2026-11-09')::text as mon, week_monday('2026-11-15')::text as sun2`,
    );
    expect(r.rows[0]).toEqual({
      sun: "2026-11-02",
      mon: "2026-11-09",
      sun2: "2026-11-09",
    });
  });

  it("session type must belong to the chosen discipline", async () => {
    await expect(
      addSession(alice, 0, { d: mt, s: boxingPads }),
    ).rejects.toThrow(/foreign key/);
    const ok = await addSession(alice, 0, { d: boxing, s: boxingPads });
    expect(ok.rows).toHaveLength(1);
  });

  it("rejects future dates and locked weeks; allows the full 4-week window", async () => {
    await expect(addSession(alice, -1)).rejects.toThrow(/future/);
    const edge = await q(`select sydney_today() - editable_from() as days`);
    const oldest = edge.rows[0].days as number;
    expect(oldest).toBeGreaterThanOrEqual(21);
    expect(oldest).toBeLessThanOrEqual(27);
    await expect(addSession(alice, oldest)).resolves.toBeTruthy();
    await expect(addSession(alice, oldest + 1)).rejects.toThrow(/locked/);
  });

  it("athletes only see their own; coach sees all", async () => {
    await addSession(alice, 0);
    await addSession(bob, 1);
    const a = await asUser(db, alice, () =>
      q(`select athlete_id from training_sessions`),
    );
    expect(a.rows.map((r) => r.athlete_id)).toEqual([alice]);
    const c = await asUser(db, coach, () =>
      q(`select count(*)::int as n from training_sessions`),
    );
    expect(c.rows[0].n).toBe(2);
  });

  it("can't log for someone else, edit theirs, or delete theirs", async () => {
    await expect(
      asUser(db, alice, () =>
        q(
          `insert into training_sessions (athlete_id, session_date, start_time, duration_min, discipline_id, session_type_id, rpe)
           values ($1, sydney_today(), '18:00', 60, $2, $3, 5)`,
          [bob, mt, bag],
        ),
      ),
    ).rejects.toThrow();
    const b = await addSession(bob, 0);
    const id = b.rows[0].id;
    const upd = await asUser(db, alice, () =>
      q(`update training_sessions set rpe = 1 where id = $1`, [id]),
    );
    expect(upd.affectedRows).toBe(0);
    const del = await asUser(db, alice, () =>
      q(`delete from training_sessions where id = $1`, [id]),
    );
    expect(del.affectedRows).toBe(0);
  });

  it("pending and deactivated athletes can't log", async () => {
    await expect(addSession(pending, 0)).rejects.toThrow(/row-level security/);
    await q(`update profiles set status = 'inactive' where id = $1`, [bob]);
    await expect(addSession(bob, 0)).rejects.toThrow(/row-level security/);
  });

  it("owner can edit and delete within the window", async () => {
    const r = await addSession(alice, 2);
    const id = r.rows[0].id;
    await asUser(db, alice, () =>
      q(`update training_sessions set rpe = 9 where id = $1`, [id]),
    );
    expect(
      (await q(`select load_au from training_sessions where id = $1`, [id]))
        .rows[0].load_au,
    ).toBe(540);
    const del = await asUser(db, alice, () =>
      q(`delete from training_sessions where id = $1`, [id]),
    );
    expect(del.affectedRows).toBe(1);
  });

  it("locked sessions can't be edited or deleted (inserted directly as admin)", async () => {
    const r = await q(
      `insert into training_sessions (athlete_id, session_date, start_time, duration_min, discipline_id, session_type_id, rpe)
       values ($1, editable_from() - 1, '18:00', 60, $2, $3, 5) returning id`,
      [alice, mt, bag],
    );
    const id = r.rows[0].id;
    await expect(
      asUser(db, alice, () =>
        q(`update training_sessions set rpe = 6 where id = $1`, [id]),
      ),
    ).rejects.toThrow(/locked/);
    const del = await asUser(db, alice, () =>
      q(`delete from training_sessions where id = $1`, [id]),
    );
    expect(del.affectedRows).toBe(0);
  });

  it("coach can log their own training", async () => {
    const r = await addSession(coach, 0);
    expect(r.rows).toHaveLength(1);
  });

  it("rejects silly values", async () => {
    await expect(addSession(alice, 0, { rpe: 11 })).rejects.toThrow(/check/);
    await expect(addSession(alice, 0, { rpe: 0 })).rejects.toThrow(/check/);
    await expect(addSession(alice, 0, { min: 4 })).rejects.toThrow(/check/);
    await expect(addSession(alice, 0, { min: 361 })).rejects.toThrow(/check/);
  });
});

const checkin = (uid: string, weeksAgo: number, extra = "") =>
  asUser(db, uid, () =>
    q(
      `insert into weekly_checkins (week_start, wellness, bodyweight_kg, niggle, niggle_note)
       values (week_monday(sydney_today()) - 7 * $1::int, 7, 70.5, ${extra ? "true" : "false"}, ${extra ? `'${extra}'` : "null"})
       returning id, submitted_at`,
      [weeksAgo],
    ),
  );

describe("weekly check-ins", () => {
  it("one per athlete per week; resubmitting updates via upsert and keeps first submitted time", async () => {
    const first = await checkin(alice, 0);
    await expect(checkin(alice, 0)).rejects.toThrow(/duplicate/);
    await asUser(db, alice, () =>
      q(`insert into weekly_checkins (week_start, wellness) values (week_monday(sydney_today()), 3)
         on conflict (athlete_id, week_start) do update set wellness = excluded.wellness`),
    );
    const r = await q(
      `select wellness, submitted_at from weekly_checkins where athlete_id = $1`,
      [alice],
    );
    expect(r.rows[0].wellness).toBe(3);
    expect(String(r.rows[0].submitted_at)).toBe(
      String(first.rows[0].submitted_at),
    );
  });

  it("week must be a Monday, not future, not locked", async () => {
    await expect(
      asUser(db, alice, () =>
        q(
          `insert into weekly_checkins (week_start, wellness) values (week_monday(sydney_today()) + 1, 5)`,
        ),
      ),
    ).rejects.toThrow(/check/);
    await expect(checkin(alice, -1)).rejects.toThrow(/future/);
    await expect(checkin(alice, 3)).resolves.toBeTruthy();
    await expect(checkin(alice, 4)).rejects.toThrow(/locked/);
  });

  it("niggle note requires the niggle flag", async () => {
    await expect(checkin(alice, 0, "left shin sore")).resolves.toBeTruthy();
    await expect(
      asUser(db, bob, () =>
        q(
          `insert into weekly_checkins (week_start, wellness, niggle, niggle_note) values (week_monday(sydney_today()), 5, false, 'x')`,
        ),
      ),
    ).rejects.toThrow(/check/);
  });

  it("privacy and access: own only, coach reads all, pending blocked", async () => {
    await checkin(alice, 0);
    await checkin(bob, 0);
    expect(
      (
        await asUser(db, alice, () =>
          q(`select count(*)::int n from weekly_checkins`),
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await asUser(db, coach, () =>
          q(`select count(*)::int n from weekly_checkins`),
        )
      ).rows[0].n,
    ).toBe(2);
    await expect(checkin(pending, 0)).rejects.toThrow(/row-level security/);
  });
});

describe("migration 003 re-run safety", () => {
  it("hides (not deletes) Plyometrics if it was already logged, and can run twice", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        "../../supabase/migrations/003_discipline_updates.sql",
      ),
      "utf8",
    );
    // Recreate Plyometrics and log a session with it, then re-run 003
    const sc = (await q(`select id from disciplines where name = 'S&C'`))
      .rows[0].id as string;
    const ply = (
      await q(
        `insert into session_types (discipline_id, name, sort_order) values ($1, 'Plyometrics', 9) returning id`,
        [sc],
      )
    ).rows[0].id;
    await addSession(alice, 0, { d: sc, s: ply as string });
    await db.exec(sql);
    await db.exec(sql);
    const r = await q(`select active from session_types where id = $1`, [ply]);
    expect(r.rows[0].active).toBe(false);
    expect(
      (
        await q(
          `select count(*)::int n from training_sessions where session_type_id = $1`,
          [ply],
        )
      ).rows[0].n,
    ).toBe(1);
  });
});

describe("migration 004", () => {
  it("renames keep logged sessions attached and every discipline uses the same names", async () => {
    const r = await q(
      `select distinct name from session_types where name in ('Pads','Bag')`,
    );
    expect(r.rows).toHaveLength(0);
    const fs = await import("node:fs");
    const path = await import("node:path");
    await db.exec(
      fs.readFileSync(
        path.join(
          __dirname,
          "../../supabase/migrations/004_consistent_session_names.sql",
        ),
        "utf8",
      ),
    );
    const s = await addSession(alice, 0, { d: boxing, s: boxingPads });
    expect(s.rows).toHaveLength(1);
  });
});
