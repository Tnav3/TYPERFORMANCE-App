import { describe, it, expect } from "vitest";
import { currentDue, isOverdue, readAnswers, showAnswer, type FormQuestion } from "@/lib/forms";

describe("form due dates", () => {
  it("weekly and fortnightly step from the start date", () => {
    const w = { repeat: "weekly" as const, starts_on: "2026-11-23" };
    expect(currentDue(w, "2026-11-22")).toBeNull();
    expect(currentDue(w, "2026-11-23")).toBe("2026-11-23");
    expect(currentDue(w, "2026-11-29")).toBe("2026-11-23");
    expect(currentDue(w, "2026-11-30")).toBe("2026-11-30");
    expect(currentDue({ repeat: "fortnightly", starts_on: "2026-11-23" }, "2026-12-06")).toBe("2026-11-23");
    expect(currentDue({ repeat: "fortnightly", starts_on: "2026-11-23" }, "2026-12-07")).toBe("2026-12-07");
  });
  it("monthly keeps the day of month, clamped to short months", () => {
    const m = { repeat: "monthly" as const, starts_on: "2026-01-31" };
    expect(currentDue(m, "2026-02-27")).toBe("2026-01-31");
    expect(currentDue(m, "2026-02-28")).toBe("2026-02-28");
    expect(currentDue(m, "2026-03-30")).toBe("2026-02-28");
    expect(currentDue(m, "2026-03-31")).toBe("2026-03-31");
    expect(currentDue({ repeat: "monthly", starts_on: "2026-11-15" }, "2027-01-10")).toBe("2026-12-15");
  });
  it("once is due from its start date", () => {
    expect(currentDue({ repeat: "once", starts_on: "2026-11-25" }, "2026-12-30")).toBe("2026-11-25");
  });
  it("overdue after a grace period", () => {
    expect(isOverdue("2026-11-23", false, "2026-11-25")).toBe(false);
    expect(isOverdue("2026-11-23", false, "2026-11-26")).toBe(true);
    expect(isOverdue("2026-11-23", true, "2026-11-30")).toBe(false);
  });
});

describe("reading answers", () => {
  const qs: FormQuestion[] = [
    { id: "a", position: 1, kind: "scale", label: "Energy", help: null, options: [], required: true },
    { id: "b", position: 2, kind: "multi", label: "Areas", help: null, options: ["Knee", "Back"], required: false },
    { id: "c", position: 3, kind: "yesno", label: "Pain?", help: null, options: [], required: true },
    { id: "d", position: 4, kind: "number", label: "Weight", help: null, options: [], required: false },
  ];
  const form = (o: Record<string, string | string[]>) => ({
    get: (k: string) => (typeof o[k] === "string" ? (o[k] as string) : null),
    getAll: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[]) : []),
  });
  it("parses and validates", () => {
    const f = form({ q_a: "7", q_b: ["Knee", "Elbow"], q_c: "no", q_d: "81,5" });
    expect(readAnswers(qs, f.get, f.getAll)).toEqual({ answers: { a: 7, b: ["Knee"], c: false, d: 81.5 } });
    const g = form({ q_c: "yes" });
    expect(readAnswers(qs, g.get, g.getAll).error).toMatch(/Energy/);
    const h = form({ q_a: "11", q_c: "yes" });
    expect(readAnswers(qs, h.get, h.getAll).error).toMatch(/1–10/);
  });
  it("formats answers", () => {
    expect(showAnswer(true)).toBe("Yes");
    expect(showAnswer(["a", "b"])).toBe("a, b");
    expect(showAnswer(undefined)).toBe("—");
  });
});
