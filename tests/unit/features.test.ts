import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { FEATURES, FEATURE_COLUMNS } from "@/lib/features";

describe("feature switches stay in sync", () => {
  it("the coach action accepts every feature shown as a switch", () => {
    expect(FEATURE_COLUMNS).toEqual(FEATURES.map((f) => f.column));
    expect(FEATURE_COLUMNS).toEqual(
      expect.arrayContaining(["feat_checkin", "feat_testing", "feat_1rm", "feat_mas", "feat_rpe", "feat_hr", "feat_fights"]),
    );
  });
  it("every switch exists in the database and is coach-only", () => {
    const sql = readdirSync("supabase/migrations").sort().map((f) => readFileSync(`supabase/migrations/${f}`, "utf8")).join("\n");
    const lastGuard = sql.slice(sql.lastIndexOf("function public.guard_profile_features()"));
    for (const col of FEATURE_COLUMNS) {
      expect(sql, `${col} column`).toMatch(new RegExp(`add column if not exists ${col}\\b`));
      expect(lastGuard, `${col} guarded`).toMatch(new RegExp(`new\\.${col}\\s+is distinct from old\\.${col}`));
    }
  });
});
