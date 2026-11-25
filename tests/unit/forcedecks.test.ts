import { describe, expect, it } from "vitest";
import { FD_TESTS, fdHeadline } from "@/lib/forcedecks";
import { TEST_FIELDS, headlineValue, derivedFor } from "@/lib/testing";

describe("ForceDecks catalogue", () => {
  it("every pickable test has fields and a headline", () => {
    for (const t of FD_TESTS) {
      expect(TEST_FIELDS[t.key], t.key).toBeTruthy();
      const v = Object.fromEntries(TEST_FIELDS[t.key].map((f) => [f.key, f.min + 1]));
      expect(headlineValue(t.key, v), t.key).not.toBeNull();
    }
  });
  it("uses the weaker side for left/right tests", () => {
    expect(fdHeadline("slhj", { left_rsi: 1.8, right_rsi: 2.1 })).toEqual({ value: 1.8, unit: "(weaker side)" });
    expect(fdHeadline("sl_stand", { left_cop_mm2: 300, right_cop_mm2: 420 })?.value).toBe(420);
    expect(derivedFor("iso_hamstring", { left_n: 300, right_n: 360 }, 80)[0].label).toBe("Asymmetry");
  });
});
