import { describe, it, expect } from "vitest";
import { addPlanned, afterLogged, planned, removePlanned, toColumns } from "@/lib/planned-fights";

const T = "2026-11-09";
describe("planned fights", () => {
  it("keeps them sorted: earliest is the next fight", () => {
    expect(toColumns(["2027-03-01", null, "2026-12-12"])).toEqual({ next_fight_date: "2026-12-12", second_fight_date: "2027-03-01" });
    expect(planned({ next_fight_date: null, second_fight_date: null })).toEqual([]);
  });
  it("adds a second fight, before or after the first", () => {
    expect(addPlanned({ next_fight_date: "2026-12-12" }, "2027-02-01", T)).toEqual({ next_fight_date: "2026-12-12", second_fight_date: "2027-02-01" });
    expect(addPlanned({ next_fight_date: "2026-12-12" }, "2026-11-20", T)).toEqual({ next_fight_date: "2026-11-20", second_fight_date: "2026-12-12" });
  });
  it("stops at two, and explains why", () => {
    const two = { next_fight_date: "2026-12-12", second_fight_date: "2027-02-01" };
    expect(addPlanned(two, "2027-05-01", T)).toEqual({ error: "You already have 2 fights planned. Remove one first." });
    expect(addPlanned({ next_fight_date: "2026-11-01", second_fight_date: "2027-02-01" }, "2027-05-01", T)).toHaveProperty("error", "Log your last fight's result first, then add the next one.");
  });
  it("rejects past, far-off, duplicate and bad dates", () => {
    expect(addPlanned({}, "2026-11-08", T)).toHaveProperty("error");
    expect(addPlanned({}, "2028-12-01", T)).toHaveProperty("error");
    expect(addPlanned({ next_fight_date: "2026-12-12" }, "2026-12-12", T)).toHaveProperty("error");
    expect(addPlanned({}, "soon", T)).toHaveProperty("error");
    expect(addPlanned({}, T, T)).toEqual({ next_fight_date: T, second_fight_date: null });
  });
  it("removing the next fight promotes the second", () => {
    expect(removePlanned({ next_fight_date: "2026-12-12", second_fight_date: "2027-02-01" }, "2026-12-12")).toEqual({ next_fight_date: "2027-02-01", second_fight_date: null });
  });
  it("logging a fight clears it and moves the next one up", () => {
    const two = { next_fight_date: "2026-11-07", second_fight_date: "2027-02-01" };
    expect(afterLogged(two, "2026-11-07")).toEqual({ next_fight_date: "2027-02-01", second_fight_date: null });
    expect(afterLogged(two, "2026-10-01")).toEqual(two); // an older fight logged late changes nothing
  });
});
