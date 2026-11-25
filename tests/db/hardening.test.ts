import { describe, it, expect } from "vitest";
import { freshDb, signUp } from "./harness";

describe("function hardening (085)", () => {
  it("guards have a fixed search_path and sign-up still works", async () => {
    const db = await freshDb();
    const r = await db.query<{ n: number }>(`select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname in ('guard_fight', 'sydney_today', 'e1rm') and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    expect(r.rows[0].n).toBe(0);
    const id = await signUp(db, "new@typ.test", "New");
    expect(id).toBeTruthy();
    expect((await db.query<{ d: string }>(`select public.sydney_today()::text d`)).rows[0].d).toMatch(/^\d{4}-/);
  });
});
