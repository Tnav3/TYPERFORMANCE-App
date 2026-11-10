import { describe, it, expect } from "vitest";
import {
  e1rmFrom,
  masFrom,
  masTargets,
  asymmetry,
  dsiFrom,
  derivedFor,
  headlineValue,
  validateTestValues,
  youtubeId,
  pctChange,
  TEST_FIELDS,
} from "@/lib/testing";

describe("e1RM from 3RM (avg Epley + Brzycki)", () => {
  it("matches hand calculation", () => {
    // 100 kg × 3: Epley 110, Brzycki 105.88 → avg 107.94 → 108.0
    expect(e1rmFrom(100)).toBe(108);
    // 140 × 3: Epley 154, Brzycki 148.24 → 151.12 → 151.0
    expect(e1rmFrom(140)).toBe(151);
    // 1 rep = the load itself (both formulas give w)
    expect(e1rmFrom(120, 1)).toBe(120);
  });
});

describe("MAS (distance / 300 s)", () => {
  it("1332 m → 4.44 m/s = 16.0 km/h (the HIIT manual's Athlete A)", () => {
    expect(masFrom(1332)).toEqual({ ms: 4.44, kmh: 16 });
  });
  it("targets: 120% of 4.44 m/s ≈ 5.33 m/s → 80 m in 15 s (manual example)", () => {
    const t = masTargets(4.44).find((x) => x.pct === 120)!;
    expect(t.ms).toBe(5.33);
    expect(t.m15).toBe(80);
    expect(t.m30).toBe(160);
  });
});

describe("asymmetry", () => {
  it("is relative to the stronger side and names the weaker one", () => {
    expect(asymmetry(180, 200)).toEqual({ pct: 10, weaker: "left" });
    expect(asymmetry(210, 200)).toEqual({ pct: 4.8, weaker: "right" });
    expect(asymmetry(150, 150)).toEqual({ pct: 0, weaker: null });
    expect(asymmetry(0, 0)).toBeNull();
  });
});

describe("DSI = CMJ peak force / IMTP peak force", () => {
  it("bands with inclusive 0.60–0.80 balanced", () => {
    expect(dsiFrom(1500, 3000)).toEqual({ value: 0.5, band: "ballistic" });
    expect(dsiFrom(1794, 3000)).toEqual({ value: 0.6, band: "balanced" }); // 0.598 rounds to 0.60
    expect(dsiFrom(1770, 3000)).toEqual({ value: 0.59, band: "ballistic" });
    expect(dsiFrom(2400, 3000)).toEqual({ value: 0.8, band: "balanced" });
    expect(dsiFrom(2430, 3000)).toEqual({ value: 0.81, band: "strength" });
    expect(dsiFrom(0, 3000)).toBeNull();
  });
});

describe("derived + headline", () => {
  it("3RM gives e1RM and relative strength when bodyweight known", () => {
    expect(derivedFor("trap_bar_3rm", { load_kg: 140 }, 70)).toEqual([
      { label: "Est. 1RM", value: "151 kg" },
      { label: "Relative", value: "2.16 × BW" },
    ]);
    expect(derivedFor("bench_3rm", { load_kg: 100 }, null)).toEqual([
      { label: "Est. 1RM", value: "108 kg" },
    ]);
  });
  it("bilateral tests report asymmetry; IMTP relative force", () => {
    expect(
      derivedFor("triple_hop", { left_cm: 540, right_cm: 600 }, null),
    ).toEqual([{ label: "Asymmetry", value: "10% (left weaker)" }]);
    expect(derivedFor("imtp", { peak_force_n: 3000 }, 75)).toEqual([
      { label: "Relative", value: "40 N/kg" },
    ]);
  });
  it("headline values", () => {
    expect(headlineValue("mas_5min", { distance_m: 1332 })).toEqual({
      value: 4.44,
      unit: "m/s",
    });
    expect(
      headlineValue("lateral_bound", { left_cm: 210, right_cm: 190 }),
    ).toEqual({ value: 1.9, unit: "m (weaker leg)" });
    expect(headlineValue("cmj", {})).toBeNull();
    expect(pctChange(200, 220)).toBe(10);
    expect(pctChange(0, 5)).toBeNull();
  });
  it("every test has a field spec and a headline", () => {
    for (const k of Object.keys(TEST_FIELDS)) {
      const vals = Object.fromEntries(
        TEST_FIELDS[k].map((f) => [f.key, f.min + 1]),
      );
      expect(headlineValue(k, vals), k).not.toBeNull();
    }
  });
});

const f = (o: Record<string, string>) => ({
  get: (k: string) => (k in o ? o[k] : null),
});
describe("validation", () => {
  it("accepts good values incl. comma decimals", () => {
    expect(
      validateTestValues("med_ball_throw", f({ best_m: "7,85", ball_kg: "4" })),
    ).toEqual({ ok: true, values: { best_m: 7.85, ball_kg: 4 } });
  });
  it("rejects missing, out of range and non-whole reps", () => {
    const r = validateTestValues("chin_ups", f({ reps: "12.5" }));
    expect(r.ok).toBe(false);
    const r2 = validateTestValues("triple_hop", f({ left_cm: "540" }));
    expect(!r2.ok && Object.keys(r2.errors)).toEqual(["right_cm"]);
    const r3 = validateTestValues("mas_5min", f({ distance_m: "50" }));
    expect(!r3.ok && r3.errors.distance_m).toMatch(/Between 300 and 3000/);
  });
  it("optional-only tests need at least one value", () => {
    expect(validateTestValues("plyo_pushup", f({})).ok).toBe(false);
    expect(validateTestValues("plyo_pushup", f({ height_cm: "12" })).ok).toBe(
      true,
    );
  });
});

describe("YouTube links", () => {
  it("parses the common forms", () => {
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(youtubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(youtubeId("https://youtube.com/shorts/dQw4w9WgXcQ?si=abc")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });
  it("rejects anything else", () => {
    expect(youtubeId("https://vimeo.com/123")).toBeNull();
    expect(youtubeId("not a url")).toBeNull();
    expect(youtubeId("https://youtube.com/watch?v=short")).toBeNull();
    expect(youtubeId(null)).toBeNull();
  });
});
