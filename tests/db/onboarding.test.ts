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

describe("onboarding v2 (066)", () => {
  it("ships the Trainerize forms", async () => {
    const r = await q(`select f.name, count(*)::int n from forms f join form_questions q on q.form_id = f.id where f.name in ('Onboarding questionnaire', 'Post-competition reflection') group by 1 order by 1`);
    expect(r.rows).toEqual([{ name: "Onboarding questionnaire", n: 12 }, { name: "Post-competition reflection", n: 8 }]);
  });
  it("a step sends a message with a library file and a form; switched-off steps don't send", async () => {
    await asUser(db, coach, async () => {
      const file = (await q(`insert into coach_files (name, path, mime, size) values ('Start-up guide.pdf', 'library/guide.pdf', 'application/pdf', 1000) returning id`)).rows[0].id;
      const form = (await q(`select id from forms where name = 'Onboarding questionnaire'`)).rows[0].id;
      const s = (await q(`insert into sequences (name, trigger, active) values ('Welcome', 'approved', true) returning id`)).rows[0].id;
      await q(`insert into sequence_steps (sequence_id, day_offset, send_time, body, form_id, file_id) values ($1, 0, '00:00', 'Hi {first_name}', $2, $3)`, [s, form, file]);
      await q(`insert into sequence_steps (sequence_id, day_offset, send_time, body, active) values ($1, 0, '00:00', 'Off step', false)`, [s]);
    });
    await q(`update profiles set status = 'active', feat_chat = true where id = $1`, [alice]);
    await q(`select send_sequence_steps()`);
    const m = await q(`select body, file_id is not null has_file from messages where athlete_id = $1`, [alice]);
    expect(m.rows).toEqual([{ body: "Hi Alice", has_file: true }]);
    expect((await q(`select repeat from form_assignments where athlete_id = $1`, [alice])).rows).toEqual([{ repeat: "once" }]);
  });
});
