import { describe, it, expect } from "vitest";
import { programRunway } from "@/lib/programming/runway";

const clients = [
  { id: "a", name: "Alice" },
  { id: "b", name: "Bob" },
  { id: "c", name: "Cara" },
  { id: "d", name: "Dan" },
];

describe("needs-a-program runway", () => {
  it("flags within a week, within a fortnight and nothing scheduled; hides the rest", () => {
    const r = programRunway(
      "2026-12-01",
      clients,
      [
        { athlete_id: "a", group_id: null, workout_date: "2026-12-04" }, // 3 days
        { athlete_id: "b", group_id: null, workout_date: "2026-12-11" }, // 10 days
        { athlete_id: null, group_id: "g", workout_date: "2026-12-30" }, // Cara via group: fine
        { athlete_id: "d", group_id: null, workout_date: "2026-11-20" }, // past: ignored
      ],
      [{ group_id: "g", athlete_id: "c" }],
    );
    expect(r.map((x) => [x.name, x.urgency, x.daysLeft])).toEqual([
      ["Dan", "none", null],
      ["Alice", "week", 3],
      ["Bob", "fortnight", 10],
    ]);
  });
  it("a group's later workouts extend a member's own runway", () => {
    const r = programRunway(
      "2026-12-01",
      [{ id: "a", name: "Alice" }],
      [
        { athlete_id: "a", group_id: null, workout_date: "2026-12-03" },
        { athlete_id: null, group_id: "g", workout_date: "2026-12-12" },
      ],
      [{ group_id: "g", athlete_id: "a" }],
    );
    expect(r[0]).toMatchObject({ urgency: "fortnight", lastDate: "2026-12-12" });
  });
});
