import { describe, it, expect } from "vitest";
import { gateState, HOME_FOR } from "@/lib/gate";
import { CONSENT_VERSION } from "@/lib/consent";
import { validateProfile } from "@/lib/profile-validation";
import { todayISO, daysBetween, isISODate } from "@/lib/dates";
import { fightCountdown } from "@/lib/fight";
import { safeNext } from "@/lib/safe-next";

const base = {
  role: "athlete" as const,
  status: "pending" as const,
  consent_version: null,
  profile_completed_at: null,
};

describe("gate — who goes where", () => {
  it("routes every state correctly", () => {
    expect(gateState(null)).toBe("signed_out");
    expect(gateState(base)).toBe("needs_consent");
    expect(gateState({ ...base, consent_version: "old-version" })).toBe(
      "needs_consent",
    ); // re-consent on wording change
    expect(gateState({ ...base, consent_version: CONSENT_VERSION })).toBe(
      "needs_profile",
    );
    expect(
      gateState({
        ...base,
        consent_version: CONSENT_VERSION,
        profile_completed_at: "x",
      }),
    ).toBe("pending");
    expect(
      gateState({
        ...base,
        status: "active",
        consent_version: CONSENT_VERSION,
        profile_completed_at: "x",
      }),
    ).toBe("athlete");
    // approved before finishing onboarding → still has to finish onboarding
    expect(gateState({ ...base, status: "active" })).toBe("needs_consent");
    // inactive beats everything
    expect(
      gateState({
        ...base,
        status: "inactive",
        consent_version: CONSENT_VERSION,
        profile_completed_at: "x",
      }),
    ).toBe("inactive");
    expect(gateState({ ...base, role: "coach", status: "active" })).toBe(
      "coach",
    );
    expect(gateState({ ...base, role: "coach", status: "inactive" })).toBe(
      "inactive",
    );
  });
  it("every state has a home screen", () => {
    for (const s of [
      "signed_out",
      "inactive",
      "needs_consent",
      "needs_profile",
      "pending",
      "athlete",
      "coach",
    ] as const) {
      expect(HOME_FOR[s]).toMatch(/^\//);
    }
  });
});

describe("dates — Sydney vs server UTC", () => {
  it("uses Sydney date, not UTC (7am Sydney Monday = 8pm UTC Sunday)", () => {
    const t = new Date("2026-11-08T20:00:00Z"); // Mon 9 Nov 07:00 AEDT
    expect(todayISO(t)).toBe("2026-11-09");
  });
  it("handles daylight saving change (AEST, winter)", () => {
    const t = new Date("2026-06-30T14:30:00Z"); // 1 Jul 00:30 AEST (+10)
    expect(todayISO(t)).toBe("2026-07-01");
  });
  it("daysBetween across DST boundary is whole days", () => {
    expect(daysBetween("2026-10-03", "2026-10-05")).toBe(2); // DST starts 4 Oct 2026
    expect(daysBetween("2026-04-04", "2026-04-06")).toBe(2); // DST ends 5 Apr 2026
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-11-10", "2026-11-08")).toBe(-2);
  });
  it("rejects impossible dates", () => {
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("26-1-1")).toBe(false);
  });
});

describe("fight countdown", () => {
  it("formats weeks and days", () => {
    expect(fightCountdown("2026-12-20", "2026-11-08")?.label).toBe("6w out");
    expect(fightCountdown("2026-12-23", "2026-11-08")?.label).toBe("6w 3d out");
    expect(fightCountdown("2026-11-09", "2026-11-08")?.label).toBe("1 day out");
    expect(fightCountdown("2026-11-08", "2026-11-08")?.label).toBe("Fight day");
    expect(fightCountdown("2026-11-01", "2026-11-08")?.past).toBe(true);
    expect(fightCountdown(null, "2026-11-08")).toBeNull();
  });
});

const D = "11111111-1111-4111-8111-111111111111";
const form = (o: Record<string, string>) => ({
  get: (k: string) => (k in o ? o[k] : null),
});
const TODAY = "2026-11-08";

describe("profile validation", () => {
  it("sex is optional: male, female or not given", () => {
    const base = { full_name: "Al", main_discipline_id: D, competing: "no", training_age_years: "1" };
    const ok = (sex: string) => {
      const r = validateProfile(form({ ...base, sex }), TODAY);
      return r.ok ? r.data.sex : "invalid";
    };
    expect(ok("female")).toBe("female");
    expect(ok("male")).toBe("male");
    expect(ok("")).toBeNull();
    expect(ok("other")).toBeNull();
  });
  it("accepts a full competing profile", () => {
    const r = validateProfile(
      form({
        full_name: "  Alice   Fighter ",
        main_discipline_id: D,
        competing: "yes",
        weight_class: "Lightweight",
        weight_class_limit_kg: "70,3",
        next_fight_date: "2027-02-14",
        training_age_years: "2.4",
      }),
      TODAY,
    );
    expect(r).toEqual({
      ok: true,
      data: {
        full_name: "Alice Fighter",
        main_discipline_id: D,
        competing: true,
        weight_class: "Lightweight",
        weight_class_limit_kg: 70.3,
        next_fight_date: "2027-02-14",
        training_age_years: 2.5,
        sex: null,
      },
    });
  });
  it("non-competing athlete: weight class and fight date are cleared even if sent", () => {
    const r = validateProfile(
      form({
        full_name: "Bob",
        main_discipline_id: D,
        competing: "no",
        weight_class: "Leftover",
        weight_class_limit_kg: "77",
        next_fight_date: "2027-01-01",
        training_age_years: "0",
      }),
      TODAY,
    );
    expect(r.ok && r.data).toMatchObject({
      competing: false,
      weight_class: null,
      weight_class_limit_kg: null,
      next_fight_date: null,
      training_age_years: 0,
    });
  });
  it("competing: fight date is optional", () => {
    const r = validateProfile(
      form({
        full_name: "Bob",
        main_discipline_id: D,
        competing: "yes",
        weight_class: "Welter",
        weight_class_limit_kg: "77.1",
        training_age_years: "3",
      }),
      TODAY,
    );
    expect(r.ok && r.data.next_fight_date).toBeNull();
  });
  it("flags every bad field", () => {
    const r = validateProfile(
      form({
        full_name: "A",
        main_discipline_id: "not-a-uuid",
        competing: "yes",
        weight_class: "",
        weight_class_limit_kg: "700",
        next_fight_date: "2026-11-07",
        training_age_years: "abc",
      }),
      TODAY,
    );
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(Object.keys(r.errors).sort()).toEqual([
        "full_name",
        "main_discipline_id",
        "next_fight_date",
        "training_age_years",
        "weight_class",
        "weight_class_limit_kg",
      ]);
  });
  it("fight today is allowed; >2 years is not; impossible dates rejected", () => {
    const ok = (fd: string) =>
      validateProfile(
        form({
          full_name: "Al",
          main_discipline_id: D,
          competing: "yes",
          weight_class: "X",
          weight_class_limit_kg: "60",
          next_fight_date: fd,
          training_age_years: "1",
        }),
        TODAY,
      ).ok;
    expect(ok("2026-11-08")).toBe(true);
    expect(ok("2028-11-09")).toBe(false);
    expect(ok("2027-02-30")).toBe(false);
  });
  it("missing training age is an error, not zero", () => {
    const r = validateProfile(
      form({ full_name: "Al", main_discipline_id: D, competing: "no" }),
      TODAY,
    );
    expect(!r.ok && r.errors.training_age_years).toBeTruthy();
  });
});

describe("redirect safety", () => {
  it("blocks redirects off-site", () => {
    expect(safeNext("/reset-password")).toBe("/reset-password");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
