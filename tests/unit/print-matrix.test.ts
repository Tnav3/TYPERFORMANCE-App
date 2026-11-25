import { describe, expect, it } from "vitest";
import { buildDayTables, type PrintItem } from "@/lib/programming/print-matrix";

const item = (w: string, block: string, slot: number, name: string, reps: string, extra: Partial<PrintItem> = {}): PrintItem => ({
  workout_id: w, kind: "exercise", block, slot, position: slot, title: null, notes: null, sets: 3, reps,
  load_type: null, percent: null, rpe: null, load_kg: null, tempo: null, rest_sec: null, set_plan: null, exercises: { name }, ...extra,
});

describe("buildDayTables", () => {
  it("lines up each exercise across weeks, one table per training day", () => {
    const ws = [
      { id: "a", workout_date: "2026-11-02", title: "Lower" },
      { id: "b", workout_date: "2026-11-04", title: "Upper" },
      { id: "c", workout_date: "2026-11-09", title: "Lower" },
    ];
    const its = [item("a", "A", 1, "Back Squat", "5"), item("c", "A", 1, "Back Squat", "4", { rest_sec: 180 }), item("b", "A", 1, "Bench Press", "8")];
    const t = buildDayTables(ws, its, "2026-11-02");
    expect(t.weeks).toBe(2);
    expect(t.days.map((d) => d.heading)).toEqual(["Day 1 · Monday · Lower", "Day 2 · Wednesday · Upper"]);
    expect(t.days[0].rows[0].cells.map((c) => c?.rx)).toEqual(["3 × 5", "3 × 4, rest 3 min"]);
    expect(t.days[1].rows[0].cells[1]).toBeNull();
  });
  it("notes a swapped exercise in that week's cell", () => {
    const ws = [{ id: "a", workout_date: "2026-11-02", title: "L" }, { id: "c", workout_date: "2026-11-09", title: "L" }];
    const t = buildDayTables(ws, [item("a", "A", 1, "Back Squat", "5"), item("c", "A", 1, "Front Squat", "5")], "2026-11-02");
    expect(t.days[0].rows[0].cells[1]?.name).toBe("Front Squat");
  });
});
