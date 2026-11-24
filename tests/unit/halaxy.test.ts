import { describe, it, expect } from "vitest";
import { halaxySummary } from "@/lib/programming/halaxy";

describe("Halaxy summary", () => {
  it("reads as plain clinical text", () => {
    const t = halaxySummary({
      date: "Wed 25 Nov 2026",
      title: "Lower A",
      rpe: 7,
      minutes: 55,
      readiness: 72,
      lines: [
        { label: "A1", name: "Goblet Squat", swappedFrom: "Back Squat", swapReason: "Pain or niggle", prescribed: "3 × 8 @ RPE 7", actual: ["8 × 24 kg", "8 × 24 kg"], setsPlanned: 3, comment: "left knee ok" },
        { label: "B", name: "Mobility", text: true, done: true, prescribed: "", actual: [] },
      ],
      comment: "Felt good",
    });
    expect(t).toBe(
      [
        "Exercise session Wed 25 Nov 2026: Lower A (TYPERFORMANCE app).",
        "Session RPE 7/10, 55 min, load 385 AU, readiness 72/100.",
        "A1 Goblet Squat (substituted for Back Squat, reason: pain or niggle). Prescribed 3 × 8 @ RPE 7. Completed 8 × 24 kg, 8 × 24 kg (2/3 sets). Client note: left knee ok",
        "B Mobility: completed.",
        "Client comment: Felt good",
      ].join("\n"),
    );
  });
});
