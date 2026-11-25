import { describe, it, expect } from "vitest";
import { amountText } from "@/lib/nutrition/products";

describe("product amounts", () => {
  it("weights in grams, small serves as counts", () => {
    expect(amountText({ serve: 150 }, 1)).toBe("150 g");
    expect(amountText({ serve: 150 }, 1.5)).toBe("225 g");
    expect(amountText({ serve: 2 }, 1)).toBe("2 serves");
    expect(amountText({ serve: 1 }, 1)).toBe("1 serve");
  });
});

import { isEstimate } from "@/lib/nutrition/products";
describe("verified flags", () => {
  it("label wording variants count as verified; estimates and partials don't", () => {
    expect(isEstimate("Label-verified")).toBe(false);
    expect(isEstimate("Label-verified (Woolworths official NIP, pulled 06/07/26)")).toBe(false);
    expect(isEstimate("Nutritional composition estimate (jasmine rice)")).toBe(true);
    expect(isEstimate("Partially verified (third-party DB)")).toBe(true);
  });
});
