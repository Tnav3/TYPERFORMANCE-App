import { describe, it, expect } from "vitest";
import { scheduleLabel, sydneyToUtc } from "@/lib/programming/schedule";

describe("Sydney time → UTC", () => {
  it("summer (AEDT, +11)", () => {
    expect(sydneyToUtc("2026-11-29", "18:00")).toBe("2026-11-29T07:00:00.000Z");
  });
  it("winter (AEST, +10)", () => {
    expect(sydneyToUtc("2026-06-15", "09:30")).toBe("2026-06-14T23:30:00.000Z");
  });
  it("rejects junk", () => {
    expect(sydneyToUtc("29/11/2026", "18:00")).toBeNull();
  });
});

describe("labels", () => {
  it.each([
    [{ repeat: "weekly", weekdays: [7], every_days: null, time_of_day: "18:00:00" }, "Sun at 6:00 pm"],
    [{ repeat: "weekly", weekdays: [1, 2, 3, 4, 5], every_days: null, time_of_day: "06:30" }, "Weekdays at 6:30 am"],
    [{ repeat: "days", weekdays: null, every_days: 3, time_of_day: "12:00" }, "Every 3 days at 12:00 pm"],
  ])("%j", (s, label) => expect(scheduleLabel(s)).toBe(label));
});
