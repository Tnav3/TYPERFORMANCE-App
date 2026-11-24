import { describe, it, expect } from "vitest";
import { expiredClients, scheduledFor, signInSummary, workoutCompliance } from "@/lib/programming/overview";

const workouts = [
  { id: "w1", athlete_id: "a", group_id: null, workout_date: "2026-11-20" },
  { id: "w2", athlete_id: "a", group_id: null, workout_date: "2026-11-22" },
  { id: "g1", athlete_id: null, group_id: "G", workout_date: "2026-11-21" },
  { id: "g1b", athlete_id: "b", group_id: null, workout_date: "2026-11-21", overrides_id: "g1" },
  { id: "old", athlete_id: "a", group_id: null, workout_date: "2026-10-01" },
];
const members = [
  { group_id: "G", athlete_id: "a" },
  { group_id: "G", athlete_id: "b" },
];

describe("coach overview", () => {
  it("scheduled includes group days but not ones replaced by a personal copy", () => {
    const s = scheduledFor(workouts, members, "2026-11-17", "2026-11-23");
    expect([...s.get("a")!].sort()).toEqual(["g1", "w1", "w2"]);
    expect([...s.get("b")!]).toEqual(["g1b"]);
  });
  it("compliance per client and on average", () => {
    const s = scheduledFor(workouts, members, "2026-11-17", "2026-11-23");
    const r = workoutCompliance(["a", "b", "c"], s, [
      { athlete_id: "a", workout_id: "w1" },
      { athlete_id: "a", workout_id: "g1" },
      { athlete_id: "b", workout_id: "g1b" },
    ]);
    expect(r.per).toEqual([
      { id: "a", pct: 67, done: 2, total: 3 },
      { id: "b", pct: 100, done: 1, total: 1 },
      { id: "c", pct: null, done: 0, total: 0 },
    ]);
    expect(r.average).toBe(84);
  });
  it("expired = recent program, nothing ahead", () => {
    const past = scheduledFor(workouts, members, "2026-10-27", "2026-11-23");
    expect(expiredClients(["a", "b", "c"], past, new Set(["a"]))).toEqual(["b"]);
  });
  it("sign-in summary", () => {
    expect(
      signInSummary(["a", "b"], [
        { athlete_id: "a", opened_on: "2026-11-20" },
        { athlete_id: "a", opened_on: "2026-11-21" },
      ]),
    ).toEqual({ pctActive: 50, avgDays: 1 });
  });
});
