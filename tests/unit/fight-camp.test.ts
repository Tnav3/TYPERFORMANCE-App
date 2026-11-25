import { describe, it, expect } from "vitest";
import { campStatus } from "@/lib/fight-camp";

const add = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const today = "2026-11-25";

describe("fight camp", () => {
  it("is off outside the camp window or with no fight", () => {
    expect(campStatus({ fight: null, today, limitKg: 70, weights: [] })).toBeNull();
    expect(campStatus({ fight: add(today, 80), today, limitKg: 70, weights: [] })).toBeNull();
    expect(campStatus({ fight: add(today, -1), today, limitKg: 70, weights: [] })).toBeNull();
  });
  it("picks phases by days out", () => {
    const p = (d: number) => campStatus({ fight: add(today, d), today, limitKg: null, weights: [] })!.phase;
    expect(p(65)).toBe("general");
    expect(p(40)).toBe("specific");
    expect(p(14)).toBe("peak");
    expect(p(3)).toBe("fight_week");
    expect(p(0)).toBe("fight_day");
    expect(campStatus({ fight: add(today, 70), today, limitKg: null, weights: [] })!.week).toBe(1);
  });
  it("works out the weight make and trend", () => {
    const weights = [0, 7, 14, 21].map((n) => ({ date: add(today, -21 + n), kg: 80 - (n / 7) * 0.1 }));
    const s = campStatus({ fight: add(today, 49), today, limitKg: 72, weights })!;
    expect(s.weight!.overKg).toBeCloseTo(7.7, 1);
    expect(s.weight!.perWeekNeeded).toBeCloseTo((79.7 - 75.6) / 6, 1);
    expect(s.weight!.trendPerWeek).toBeCloseTo(-0.1, 2);
    expect(s.weight!.onTrack).toBe(false);
    expect(s.flags).toContain("Behind the weight trend this camp.");
  });
  it("flags fight week over 5%", () => {
    const s = campStatus({ fight: add(today, 4), today, limitKg: 70, weights: [{ date: today, kg: 76 }] })!;
    expect(s.flags.some((f) => /Talk to your dietitian/.test(f))).toBe(true);
  });
});
