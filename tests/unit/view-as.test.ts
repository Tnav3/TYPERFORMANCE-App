import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { asClient } from "@/lib/view-as";

describe("view as client", () => {
  it("answers my_workouts for the client being viewed and passes the rest through", () => {
    const calls: unknown[] = [];
    const fake = { rpc: (fn: string, args: unknown) => (calls.push([fn, args]), "ok"), from: (t: string) => `from:${t}` };
    const c = asClient(fake as unknown as SupabaseClient, "abc");
    c.rpc("my_workouts", { p_from: "2026-11-23", p_to: "2026-11-29" });
    c.rpc("is_coach");
    expect(calls).toEqual([
      ["client_workouts", { p_athlete: "abc", p_from: "2026-11-23", p_to: "2026-11-29" }],
      ["is_coach", undefined],
    ]);
    expect(c.from("x" as never)).toBe("from:x");
  });
});
