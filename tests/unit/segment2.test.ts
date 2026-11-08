import { describe, it, expect } from "vitest";
import {
  mondayOf,
  weekDays,
  editableFrom,
  editableWeeks,
  isEditableWeek,
  isLoggableDate,
  weekLabel,
  formatTime,
} from "@/lib/week";
import { validateSession, validateCheckin } from "@/lib/logging-validation";
import { RPE_LABELS, wellnessLabel, sessionLoad } from "@/lib/scales";

const TODAY = "2026-11-08"; // Sunday

describe("weeks (Mon–Sun)", () => {
  it("finds Monday, including from Sunday and across month/year ends", () => {
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // Sun
    expect(mondayOf("2026-11-09")).toBe("2026-11-09"); // Mon
    expect(mondayOf("2026-11-04")).toBe("2026-11-02"); // Wed
    expect(mondayOf("2027-01-02")).toBe("2026-12-28"); // across year
    expect(mondayOf("2026-03-01")).toBe("2026-02-23"); // across Feb
  });
  it("lists 7 days Mon→Sun", () => {
    expect(weekDays("2026-11-02")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });
  it("edit window = this week + 3 previous", () => {
    expect(editableWeeks(TODAY)).toEqual([
      "2026-11-02",
      "2026-10-26",
      "2026-10-19",
      "2026-10-12",
    ]);
    expect(editableFrom(TODAY)).toBe("2026-10-12");
    expect(isEditableWeek("2026-10-12", TODAY)).toBe(true);
    expect(isEditableWeek("2026-10-05", TODAY)).toBe(false);
    expect(isEditableWeek("2026-11-09", TODAY)).toBe(false); // future week
    expect(isEditableWeek("2026-11-03", TODAY)).toBe(false); // not a Monday
    expect(isLoggableDate("2026-11-08", TODAY)).toBe(true);
    expect(isLoggableDate("2026-11-09", TODAY)).toBe(false);
    expect(isLoggableDate("2026-10-12", TODAY)).toBe(true);
    expect(isLoggableDate("2026-10-11", TODAY)).toBe(false);
  });
  it("labels weeks", () => {
    expect(weekLabel("2026-11-02", TODAY)).toBe("This week");
    expect(weekLabel("2026-10-26", TODAY)).toBe("Last week");
    expect(weekLabel("2026-10-19", TODAY)).toBe("19 Oct – 25 Oct");
  });
  it("formats times", () => {
    expect(formatTime("18:30:00")).toBe("6:30 pm");
    expect(formatTime("00:05")).toBe("12:05 am");
    expect(formatTime("12:00")).toBe("12:00 pm");
  });
});

describe("scales", () => {
  it("every RPE 1–10 has a plain-English label", () => {
    for (let i = 1; i <= 10; i++)
      expect(RPE_LABELS[i].label.length).toBeGreaterThan(2);
    expect(RPE_LABELS[10].label).toBe("Max effort");
  });
  it("wellness labels cover 1–10", () => {
    expect([1, 3, 5, 7, 10].map(wellnessLabel)).toEqual([
      "Awful",
      "Poor",
      "OK",
      "Good",
      "Great",
    ]);
  });
  it("load = RPE × minutes", () => {
    expect(sessionLoad(7, 90)).toBe(630);
  });
});

const D = "11111111-1111-4111-8111-111111111111";
const T = "22222222-2222-4222-8222-222222222222";
const f = (o: Record<string, string>) => ({
  get: (k: string) => (k in o ? o[k] : null),
});
const good = {
  session_date: "2026-11-07",
  start_time: "18:30",
  duration_min: "90",
  discipline_id: D,
  session_type_id: T,
  rpe: "7",
};

describe("session validation", () => {
  it("accepts a valid session and trims seconds off time", () => {
    const r = validateSession(
      f({ ...good, start_time: "18:30:00", notes: "  " }),
      TODAY,
    );
    expect(r).toEqual({
      ok: true,
      data: {
        ...good,
        start_time: "18:30",
        duration_min: 90,
        rpe: 7,
        notes: null,
      },
    });
  });
  it("rejects future, locked, missing and out-of-range values", () => {
    const bad = (o: Record<string, string>) => {
      const r = validateSession(f({ ...good, ...o }), TODAY);
      return r.ok ? null : Object.keys(r.errors);
    };
    expect(bad({ session_date: "2026-11-09" })).toEqual(["session_date"]);
    expect(bad({ session_date: "2026-10-11" })).toEqual(["session_date"]);
    expect(bad({ start_time: "25:00" })).toEqual(["start_time"]);
    expect(bad({ duration_min: "4" })).toEqual(["duration_min"]);
    expect(bad({ duration_min: "45.5" })).toEqual(["duration_min"]);
    expect(bad({ rpe: "11" })).toEqual(["rpe"]);
    expect(bad({ rpe: "" })).toEqual(["rpe"]);
    expect(bad({ discipline_id: "" })).toEqual(["discipline_id"]);
    expect(bad({ session_type_id: "x" })).toEqual(["session_type_id"]);
    expect(bad({ notes: "x".repeat(301) })).toEqual(["notes"]);
  });
});

describe("check-in validation", () => {
  const base = { week_start: "2026-11-02", wellness: "7" };
  it("bodyweight optional; niggle requires a note; note dropped when no niggle", () => {
    const r1 = validateCheckin(f(base), TODAY);
    expect(r1.ok && r1.data).toEqual({
      week_start: "2026-11-02",
      wellness: 7,
      bodyweight_kg: null,
      niggle: false,
      niggle_note: null,
    });
    const r2 = validateCheckin(
      f({
        ...base,
        bodyweight_kg: "71,46",
        niggle: "no",
        niggle_note: "ignored",
      }),
      TODAY,
    );
    expect(r2.ok && r2.data).toMatchObject({
      bodyweight_kg: 71.5,
      niggle: false,
      niggle_note: null,
    });
    const r3 = validateCheckin(f({ ...base, niggle: "yes" }), TODAY);
    expect(!r3.ok && r3.errors.niggle_note).toBeTruthy();
    const r4 = validateCheckin(
      f({ ...base, niggle: "yes", niggle_note: "L shin" }),
      TODAY,
    );
    expect(r4.ok && r4.data.niggle_note).toBe("L shin");
  });
  it("rejects bad week, wellness and bodyweight", () => {
    const r = validateCheckin(
      f({ week_start: "2026-11-03", wellness: "0", bodyweight_kg: "250" }),
      TODAY,
    );
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual([
      "bodyweight_kg",
      "week_start",
      "wellness",
    ]);
  });
});
