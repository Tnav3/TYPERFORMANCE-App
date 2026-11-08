import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, signUp, asUser, makeCoach } from "./harness";

let db: PGlite;
let coach: string, alice: string, bob: string;

beforeEach(async () => {
  db = await freshDb();
  coach = await signUp(db, "coach@typ.test", "Tyrell");
  alice = await signUp(db, "alice@typ.test", "  Alice Fighter  ");
  bob = await signUp(db, "bob@typ.test");
  await makeCoach(db, "coach@typ.test");
});

const q = (sql: string, params: unknown[] = []) =>
  db.query<Record<string, unknown>>(sql, params);

describe("signup", () => {
  it("creates a pending athlete profile with trimmed name", async () => {
    const r = await q(
      `select role, status, full_name from profiles where id = $1`,
      [alice],
    );
    expect(r.rows[0]).toEqual({
      role: "athlete",
      status: "pending",
      full_name: "Alice Fighter",
    });
  });
  it("handles missing name", async () => {
    const r = await q(`select full_name from profiles where id = $1`, [bob]);
    expect(r.rows[0].full_name).toBeNull();
  });
  it("setup SQL makes Tyrell an active coach", async () => {
    const r = await q(`select role, status from profiles where id = $1`, [
      coach,
    ]);
    expect(r.rows[0]).toEqual({ role: "coach", status: "active" });
  });
});

describe("seed data", () => {
  it("has the 7 agreed disciplines and the agreed session types (after migration 003)", async () => {
    const d = await q(`select name from disciplines order by sort_order`);
    expect(d.rows.map((r) => r.name)).toEqual([
      "Muay Thai",
      "Boxing",
      "BJJ",
      "Wrestling",
      "MMA",
      "Kickboxing",
      "S&C",
    ]);
    const types = async (disc: string) =>
      (
        await q(
          `select s.name from session_types s join disciplines d on d.id = s.discipline_id
           where d.name = $1 and s.active order by s.sort_order`,
          [disc],
        )
      ).rows.map((r) => r.name);
    expect(await types("Muay Thai")).toEqual([
      "Bag work",
      "Pad work",
      "Sparring",
      "Clinch",
      "Drilling",
    ]);
    expect(await types("Boxing")).toEqual(["Bag work", "Pad work", "Sparring"]);
    expect(await types("BJJ")).toEqual([
      "Drilling",
      "Positional sparring",
      "Rolling",
    ]);
    expect(await types("Wrestling")).toEqual([
      "Drilling",
      "Live wrestling",
      "Conditioning",
    ]);
    expect(await types("MMA")).toEqual([
      "Striking",
      "Grappling",
      "Sparring",
      "Pad work",
      "Drilling",
    ]);
    expect(await types("Kickboxing")).toEqual([
      "Bag work",
      "Pad work",
      "Sparring",
      "Drilling",
    ]);
    expect(await types("S&C")).toEqual([
      "Strength",
      "Conditioning",
      "Running",
      "Sprints",
    ]);
  });
});

describe("athlete privacy (RLS)", () => {
  it("athlete sees only their own profile", async () => {
    const rows = await asUser(db, alice, () => q(`select id from profiles`));
    expect(rows.rows.map((r) => r.id)).toEqual([alice]);
  });
  it("logged-out visitor sees nothing", async () => {
    const rows = await asUser(db, null, () => q(`select id from profiles`));
    expect(rows.rows).toHaveLength(0);
  });
  it("athlete cannot edit another athlete", async () => {
    const r = await asUser(db, alice, () =>
      q(`update profiles set weight_class = 'Hacked' where id = $1`, [bob]),
    );
    expect(r.affectedRows).toBe(0);
  });
  it("athlete can edit their own profile fields", async () => {
    await asUser(db, alice, () =>
      q(
        `update profiles set weight_class = 'Lightweight', weight_class_limit_kg = 70.3 where id = $1`,
        [alice],
      ),
    );
    const r = await q(
      `select weight_class, weight_class_limit_kg from profiles where id = $1`,
      [alice],
    );
    expect(r.rows[0]).toEqual({
      weight_class: "Lightweight",
      weight_class_limit_kg: "70.30",
    });
  });
});

describe("access control", () => {
  it("athlete cannot approve themselves", async () => {
    await expect(
      asUser(db, alice, () =>
        q(`update profiles set status = 'active' where id = $1`, [alice]),
      ),
    ).rejects.toThrow(/Only the coach/);
  });
  it("athlete cannot make themselves coach", async () => {
    await expect(
      asUser(db, alice, () =>
        q(`update profiles set role = 'coach' where id = $1`, [alice]),
      ),
    ).rejects.toThrow(/Only the coach/);
  });
  it("athlete cannot change their email via the app", async () => {
    await expect(
      asUser(db, alice, () =>
        q(`update profiles set email = 'x@y.z' where id = $1`, [alice]),
      ),
    ).rejects.toThrow(/cannot be changed/);
  });
  it("coach sees everyone and can approve, deactivate and reactivate", async () => {
    const all = await asUser(db, coach, () => q(`select id from profiles`));
    expect(all.rows).toHaveLength(3);
    for (const status of ["active", "inactive", "active"]) {
      await asUser(db, coach, () =>
        q(`update profiles set status = $1::account_status where id = $2`, [
          status,
          alice,
        ]),
      );
      const r = await q(`select status from profiles where id = $1`, [alice]);
      expect(r.rows[0].status).toBe(status);
    }
  });
  it("coach cannot lock themselves out", async () => {
    await expect(
      asUser(db, coach, () =>
        q(`update profiles set status = 'inactive' where id = $1`, [coach]),
      ),
    ).rejects.toThrow(/cannot deactivate/);
    await expect(
      asUser(db, coach, () =>
        q(`update profiles set role = 'athlete' where id = $1`, [coach]),
      ),
    ).rejects.toThrow(/cannot deactivate/);
  });
  it("a deactivated coach row loses coach powers", async () => {
    await q(`update profiles set status = 'inactive' where id = $1`, [coach]); // as superuser
    const all = await asUser(db, coach, () => q(`select id from profiles`));
    expect(all.rows.map((r) => r.id)).toEqual([coach]);
  });
  it("is_active_user reflects status", async () => {
    const before = await asUser(db, alice, () =>
      q(`select is_active_user() as a`),
    );
    expect(before.rows[0].a).toBe(false);
    await asUser(db, coach, () =>
      q(`update profiles set status = 'active' where id = $1`, [alice]),
    );
    const after = await asUser(db, alice, () =>
      q(`select is_active_user() as a`),
    );
    expect(after.rows[0].a).toBe(true);
  });
});

describe("consent", () => {
  it("consent time is always server time, even if a client backdates it", async () => {
    await asUser(db, alice, () =>
      q(
        `update profiles set consent_accepted_at = '2001-01-01', consent_version = 'v1' where id = $1`,
        [alice],
      ),
    );
    const r = await q(
      `select consent_accepted_at > now() - interval '1 minute' as fresh from profiles where id = $1`,
      [alice],
    );
    expect(r.rows[0].fresh).toBe(true);
  });
});

describe("disciplines (coach-editable)", () => {
  it("athletes can read but not add", async () => {
    const r = await asUser(db, alice, () =>
      q(`select count(*)::int as n from disciplines`),
    );
    expect(r.rows[0].n).toBe(7);
    await expect(
      asUser(db, alice, () =>
        q(`insert into disciplines (name) values ('Judo')`),
      ),
    ).rejects.toThrow();
  });
  it("coach can add Judo with session types", async () => {
    await asUser(db, coach, async () => {
      const d = await q(
        `insert into disciplines (name, sort_order) values ('Judo', 8) returning id`,
      );
      await q(
        `insert into session_types (discipline_id, name) values ($1, 'Randori'), ($1, 'Drilling')`,
        [d.rows[0].id],
      );
    });
    const r = await asUser(db, alice, () =>
      q(
        `select s.name from session_types s join disciplines d on d.id = s.discipline_id where d.name = 'Judo' order by s.name`,
      ),
    );
    expect(r.rows.map((x) => x.name)).toEqual(["Drilling", "Randori"]);
  });
  it("rejects duplicate session types within a discipline", async () => {
    await expect(
      asUser(db, coach, () =>
        q(
          `insert into session_types (discipline_id, name) select id, 'Sparring' from disciplines where name = 'Boxing'`,
        ),
      ),
    ).rejects.toThrow(/duplicate/);
  });
});
