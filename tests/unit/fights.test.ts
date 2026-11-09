import { describe, it, expect } from "vitest";
import { byYear, recordOf, recordString, validateFight } from "@/lib/fights";

const f = (fought_on: string, result: "win" | "loss" | "draw", rounds: number) => ({ fought_on, result, rounds });

describe("fight record", () => {
  it("counts W-L-D, rounds and win %", () => {
    const r = recordOf([f("2026-03-01", "win", 3), f("2026-06-01", "loss", 5), f("2026-09-01", "win", 1), f("2026-10-01", "draw", 3)]);
    expect(r).toEqual({ wins: 2, losses: 1, draws: 1, fights: 4, rounds: 12, winPct: 50 });
    expect(recordString(r)).toBe("2-1-1");
    expect(recordOf([]).winPct).toBeNull();
  });
  it("splits by year, newest first", () => {
    const y = byYear([f("2025-05-01", "loss", 3), f("2026-01-10", "win", 2), f("2026-12-31", "win", 3)]);
    expect(y.map((x) => [x.year, recordString(x), x.rounds])).toEqual([[2026, "2-0-0", 5], [2025, "0-1-0", 3]]);
  });
  it("validates", () => {
    const today = "2026-11-09";
    expect(validateFight({ date: "2026-11-09", result: "win", rounds: 3, today })).toEqual({});
    expect(validateFight({ date: "2026-11-10", result: "win", rounds: 3, today })).toHaveProperty("date");
    expect(validateFight({ date: "2026-11-01", result: "ko", rounds: 3, today })).toHaveProperty("result");
    expect(validateFight({ date: "2026-11-01", result: "win", rounds: 0, today })).toHaveProperty("rounds");
    expect(validateFight({ date: "2026-11-01", result: "win", rounds: 2.5, today })).toHaveProperty("rounds");
  });
});
