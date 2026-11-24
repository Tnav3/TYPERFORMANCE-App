import { describe, it, expect } from "vitest";
import { DEFAULT_CATEGORIES, labelOf, slugKey } from "@/lib/programming/categories-data";

describe("categories", () => {
  it("makes safe keys", () => {
    expect(slugKey("Mobility & Flexibility")).toBe("mobility_flexibility");
    expect(slugKey("3D Movement")).toBe("c_3d_movement");
  });
  it("labels subcategories", () => {
    expect(labelOf(DEFAULT_CATEGORIES, "ballistic", "throw_rot")).toBe("Throws: rotation");
    expect(labelOf(DEFAULT_CATEGORIES, "ballistic", null)).toBeNull();
  });
});
