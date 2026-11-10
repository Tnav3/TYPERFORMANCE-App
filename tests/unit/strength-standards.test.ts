import { describe, it, expect } from "vitest";
import { UFC_CMJ, UFC_TIERS, ufcClassForLimit, ufcTier, ufcNext, ufcClassesFor } from "@/lib/ufc-cmj";
import { OVERVIEW, currentFor } from "@/lib/strength-standards";
import { toolsFor, toolsSummary, TOOLS } from "@/lib/tools";
import { STANDARD_METRICS } from "@/lib/standards";

describe("UFC PI CMJ table (transcription guard)", () => {
  it("has 8 men's and 4 women's divisions with strictly falling floors", () => {
    expect(ufcClassesFor("male")).toHaveLength(8);
    expect(ufcClassesFor("female")).toHaveLength(4);
    for (const c of UFC_CMJ) {
      for (let i = 1; i < c.floors.length; i++) expect(c.floors[i]).toBeLessThan(c.floors[i - 1]);
      expect(c.floors[5]).toBeGreaterThan(20);
      expect(c.floors[0]).toBeLessThan(70);
    }
  });
  it("matches spot values printed in Table 11.1", () => {
    const f = (code: string) => UFC_CMJ.find((c) => c.code === code)!.floors;
    expect(f("LHW")[0]).toBe(65.7);
    expect(f("HW")[5]).toBe(26.5);
    expect(f("WFLW")[2]).toBe(38.9);
    expect(f("WW")[3]).toBe(45.3);
  });
  it("tiers: boundary counts as the higher tier, below the last floor is Bad", () => {
    const lw = UFC_CMJ.find((c) => c.code === "LW")!;
    expect(ufcTier(58.2, lw)).toBe("World Class");
    expect(ufcTier(58.1, lw)).toBe("Very Good");
    expect(ufcTier(50.5, lw)).toBe("Good");
    expect(ufcTier(36.2, lw)).toBe("Very Poor");
    expect(ufcTier(36.1, lw)).toBe("Bad");
    expect(UFC_TIERS).toHaveLength(7);
  });
  it("next tier and gap", () => {
    const lw = UFC_CMJ.find((c) => c.code === "LW")!;
    expect(ufcNext(45, lw)).toEqual({ tier: "Good", at: 50.5, gap: 5.5 });
    expect(ufcNext(20, lw)).toEqual({ tier: "Very Poor", at: 36.2, gap: 16.2 });
    expect(ufcNext(60, lw)).toBeNull();
  });
  it("maps an athlete's own limit to the lightest UFC division that fits", () => {
    expect(ufcClassForLimit("male", 75)!.code).toBe("WW");
    expect(ufcClassForLimit("male", 70.3)!.code).toBe("LW");
    expect(ufcClassForLimit("male", 70.31)!.code).toBe("LW"); // rounding slack
    expect(ufcClassForLimit("male", 130)!.code).toBe("HW");
    expect(ufcClassForLimit("female", 54)!.code).toBe("WFLW");
    expect(ufcClassForLimit("female", 70)!.code).toBe("WFTW");
    expect(ufcClassForLimit("male", null)).toBeNull();
  });
});

describe("Strength Standards overview", () => {
  const trap = OVERVIEW.find((r) => r.testKey === "trap_bar_3rm")!;
  const squat = OVERVIEW.find((r) => r.testKey === "box_squat_3rm")!;
  const e = (on: string, load: number, bw: number | null) => ({
    test_key: "trap_bar_3rm", tested_on: on, created_at: `${on}T10:00:00Z`, values: { load_kg: load }, bodyweight_kg: bw,
  });
  const m = (key: string, on: string, e1rm: number, bw: number | null) => ({
    lift_key: key, e1rm_kg: String(e1rm), bodyweight_kg: bw == null ? null : String(bw), saved_on: on, created_at: `${on}T10:00:00Z`,
  });

  it("every row has a standards metric", () => {
    for (const r of OVERVIEW) expect(STANDARD_METRICS[r.testKey]).toBeDefined();
  });
  it("uses the newer of test and saved 1RM", () => {
    // 3RM 150 @ 75 kg: e1RM 162 → 2.16
    expect(currentFor(trap, [e("2026-10-01", 150, 75)], [m("trap_bar_dl", "2026-09-01", 200, 80)], null))
      .toEqual({ value: 2.16, values: { load_kg: 150 }, on: "2026-10-01", from: "test" });
    expect(currentFor(trap, [e("2026-10-01", 150, 75)], [m("trap_bar_dl", "2026-11-01", 200, 80)], null))
      .toEqual({ value: 2.5, on: "2026-11-01", from: "1rm" });
  });
  it("saved max without bodyweight falls back to the check-in, else skipped", () => {
    expect(currentFor(trap, [], [m("trap_bar_dl", "2026-11-01", 200, null)], 100)!.value).toBe(2);
    expect(currentFor(trap, [], [m("trap_bar_dl", "2026-11-01", 200, null)], null)).toBeNull();
  });
  it("only counts its own lifts and tests", () => {
    expect(currentFor(trap, [], [m("deadlift", "2026-11-01", 200, 80)], null)!.value).toBe(2.5);
    expect(currentFor(trap, [], [m("rdl", "2026-11-01", 200, 80)], null)).toBeNull();
    expect(currentFor(squat, [e("2026-10-01", 150, 75)], [], null)).toBeNull();
    expect(currentFor(squat, [], [m("back_squat", "2026-11-01", 160, 80)], null)!.value).toBe(2);
  });
  it("test without bodyweight gives nothing for a ×BW lift", () => {
    expect(currentFor(trap, [e("2026-10-01", 150, null)], [], null)).toBeNull();
  });
});

describe("Training Tools", () => {
  const p = (o: Record<string, boolean>) => ({ role: "athlete" as const, feat_1rm: true, feat_mas: true, feat_rpe: true, feat_hr: true, feat_testing: true, ...o });
  it("lists only switched-on tools; Standards need Testing or 1RM", () => {
    expect(toolsFor(p({})).map((t) => t.key)).toEqual(["1rm", "mas", "rpe", "hr", "standards"]);
    expect(toolsFor(p({ feat_1rm: false })).map((t) => t.key)).toEqual(["mas", "rpe", "hr", "standards"]);
    expect(toolsFor(p({ feat_1rm: false, feat_testing: false })).map((t) => t.key)).toEqual(["mas", "rpe", "hr"]);
    expect(toolsFor(p({ feat_1rm: false, feat_testing: false, feat_mas: false, feat_rpe: false, feat_hr: false }))).toEqual([]);
  });
  it("summary line names what's inside", () => {
    expect(toolsSummary(TOOLS)).toBe("1RM · MAS · RPE & RIR · HR Zones · Standards");
  });
});

describe("CMJ standards from UFC PI", () => {
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length / 2;
    return Math.round(((s[m - 1] + s[m]) / 2) * 100) / 100;
  };
  it("migration 019 fallback rows = median of division tiers", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/019_standards_research.sql", "utf8");
    for (const sex of ["male", "female"] as const) {
      const cs = ufcClassesFor(sex);
      const want = [2, 1, 0].map((i) => median(cs.map((c) => c.floors[i])));
      const row = new RegExp(`\\('${sex}',\\s*([\\d.]+), ([\\d.]+), ([\\d.]+),`).exec(sql)!;
      expect(row.slice(1, 4).map(Number)).toEqual(want);
    }
  });
  it("division standard: Bronze Good, Silver Very Good, Gold World Class", async () => {
    const { ufcCmjStandard } = await import("@/lib/ufc-cmj");
    const lw = UFC_CMJ.find((c) => c.code === "LW")!;
    expect(ufcCmjStandard(lw)).toMatchObject({ bronze: 50.5, silver: 53.8, gold: 58.2, sex: "male" });
  });
  it("standardFor uses the division when a limit is known, else the row", async () => {
    const { standardFor } = await import("@/lib/standards-data");
    const row = { test_key: "cmj", sex: "male" as const, bronze: 51.4, silver: 55.55, gold: 60.1, source: null };
    const all = { "cmj:male": row, "bench_3rm:male": { ...row, test_key: "bench_3rm" } };
    expect(standardFor(all, "cmj", "male", "75.00")!.gold).toBe(59.9); // WW
    expect(standardFor(all, "cmj", "male", null)).toBe(row);
    expect(standardFor(all, "bench_3rm", "male", 75)!.test_key).toBe("bench_3rm");
    expect(standardFor(all, "cmj", null, 75)).toBeNull();
  });
  it("deadlift row covers trap bar and barbell", () => {
    expect(OVERVIEW[0].lifts).toEqual(["trap_bar_dl", "deadlift"]);
  });
});

describe("Bronze with a light band (chin-ups)", () => {
  const women = { test_key: "chin_ups", sex: "female" as const, bronze: null, silver: 1, gold: 5, source: null };
  const men = { ...women, sex: "male" as const, bronze: 10, silver: 16, gold: 24 };
  it("0 clean reps + 5 band reps = Bronze when Bronze is blank", async () => {
    const { entryLevel } = await import("@/lib/standards");
    expect(entryLevel("chin_ups", { reps: 0, band_reps: 5 }, 0, women)).toBe("bronze");
    expect(entryLevel("chin_ups", { reps: 0, band_reps: 4 }, 0, women)).toBe("below");
    expect(entryLevel("chin_ups", { reps: 0 }, 0, women)).toBe("below");
    expect(entryLevel("chin_ups", { reps: 2, band_reps: 9 }, 2, women)).toBe("silver");
    expect(entryLevel("chin_ups", { reps: 6 }, 6, women)).toBe("gold");
  });
  it("doesn't apply when the coach set a Bronze number (men: 10 strict)", async () => {
    const { entryLevel } = await import("@/lib/standards");
    expect(entryLevel("chin_ups", { reps: 0, band_reps: 20 }, 0, men)).toBe("below");
    expect(entryLevel("bench_3rm", { band_reps: 20 }, 0.5, { ...women, test_key: "bench_3rm" })).toBe("below");
  });
  it("band reps are optional, and headline shows them when there are no clean reps", async () => {
    const { validateTestValues, headlineValue } = await import("@/lib/testing");
    const f = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
    expect(validateTestValues("chin_ups", f({ reps: "0" }))).toEqual({ ok: true, values: { reps: 0 } });
    expect(validateTestValues("chin_ups", f({ reps: "0", band_reps: "7" }))).toEqual({ ok: true, values: { reps: 0, band_reps: 7 } });
    expect(validateTestValues("chin_ups", f({ reps: "0", band_reps: "0" })).ok).toBe(false);
    expect(headlineValue("chin_ups", { reps: 0, band_reps: 7 })).toEqual({ value: 7, unit: "reps (light band)" });
    expect(headlineValue("chin_ups", { reps: 3, band_reps: 7 })).toEqual({ value: 3, unit: "reps" });
  });
});

describe("overview groups", () => {
  it("every movement sits in Strength or Power, lifts in Strength", async () => {
    const { GROUPS } = await import("@/lib/strength-standards");
    const keys = GROUPS.map((g) => g.key);
    for (const r of OVERVIEW) expect(keys).toContain(r.group);
    for (const r of OVERVIEW.filter((x) => x.lifts)) expect(r.group).toBe("strength");
    expect(OVERVIEW.filter((r) => r.group === "power").map((r) => r.testKey)).toEqual(["broad_jump", "triple_hop", "cmj"]);
  });
});
