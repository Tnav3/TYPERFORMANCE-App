import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string;
const q = (sql: string, params: unknown[] = []) =>
  db.query<Record<string, unknown>>(sql, params);

beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Tyrell");
  alice = await signUp(db, "alice@typ.test", "Alice");
  bob = await signUp(db, "bob@typ.test", "Bob");
  await makeCoach(db, "coach@typ.test");
  await q(`update profiles set status = 'active' where id in ($1, $2)`, [
    alice,
    bob,
  ]);
});

const note = (athlete: string, visible: boolean, text = "Good week") =>
  asUser(db, coach, () =>
    q(
      `insert into coach_notes (athlete_id, week_start, note, visible_to_athlete)
       values ($1, week_monday(sydney_today()), $2, $3)
       on conflict (athlete_id, week_start) do update set note = excluded.note, visible_to_athlete = excluded.visible_to_athlete
       returning id`,
      [athlete, text, visible],
    ),
  );

describe("coach notes", () => {
  it("coach writes and reads; one per athlete per week (upsert updates)", async () => {
    await note(alice, false, "first");
    await note(alice, false, "second");
    const r = await asUser(db, coach, () =>
      q(`select note from coach_notes where athlete_id = $1`, [alice]),
    );
    expect(r.rows.map((x) => x.note)).toEqual(["second"]);
  });

  it("private notes are hidden from the athlete; shared ones are visible to that athlete only", async () => {
    await note(alice, false, "private");
    expect(
      (
        await asUser(db, alice, () =>
          q(`select count(*)::int n from coach_notes`),
        )
      ).rows[0].n,
    ).toBe(0);
    await note(alice, true, "shared");
    const a = await asUser(db, alice, () => q(`select note from coach_notes`));
    expect(a.rows.map((x) => x.note)).toEqual(["shared"]);
    expect(
      (
        await asUser(db, bob, () =>
          q(`select count(*)::int n from coach_notes`),
        )
      ).rows[0].n,
    ).toBe(0);
  });

  it("athletes can't write, edit or delete notes", async () => {
    await expect(
      asUser(db, alice, () =>
        q(
          `insert into coach_notes (athlete_id, week_start, note) values ($1, week_monday(sydney_today()), 'hi')`,
          [alice],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await note(alice, true);
    const u = await asUser(db, alice, () =>
      q(`update coach_notes set note = 'hacked'`),
    );
    expect(u.affectedRows).toBe(0);
    const d = await asUser(db, alice, () => q(`delete from coach_notes`));
    expect(d.affectedRows).toBe(0);
  });

  it("rejects empty notes and non-Monday weeks", async () => {
    await expect(note(alice, false, "   ")).rejects.toThrow(/check/);
    await expect(
      asUser(db, coach, () =>
        q(
          `insert into coach_notes (athlete_id, week_start, note) values ($1, week_monday(sydney_today()) + 2, 'x')`,
          [alice],
        ),
      ),
    ).rejects.toThrow(/check/);
  });

  it("coach can read every athlete's sessions and check-ins (for the dashboard)", async () => {
    const ids = await q(
      `select d.id did, s.id sid from session_types s join disciplines d on d.id = s.discipline_id where d.name = 'BJJ' limit 1`,
    );
    const { did, sid } = ids.rows[0] as { did: string; sid: string };
    for (const u of [alice, bob]) {
      await asUser(db, u, () =>
        q(
          `insert into training_sessions (session_date, start_time, duration_min, discipline_id, session_type_id, rpe)
           values (sydney_today(), '18:00', 60, $1, $2, 6)`,
          [did, sid],
        ),
      );
    }
    const r = await asUser(db, coach, () =>
      q(`select count(distinct athlete_id)::int n from training_sessions`),
    );
    expect(r.rows[0].n).toBe(2);
  });
});
