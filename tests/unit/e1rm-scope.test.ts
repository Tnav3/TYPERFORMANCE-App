import { describe, expect, it } from "vitest";
import { usesE1rm } from "@/lib/programming/e1rm-scope";

describe("usesE1rm", () => {
  it("drops it for bodyweight, med ball and dumbbell plyos and throws", () => {
    for (const name of ["Box Jump", "Extensive Pogo Jump", "Lateral Bound & Stick", "Dumbbell Box Jump", "Intensive Standing Medball Slam Single", "Med Ball Chest Pass", "Depth Landing - Single Leg"])
      expect(usesE1rm({ name, category: "plyometric" }), name).toBe(false);
    expect(usesE1rm({ name: "Med Ball Rotational Throw", category: "ballistic" })).toBe(false);
  });
  it("keeps it for barbell and trap bar jumps, Olympic lifts and normal lifts", () => {
    expect(usesE1rm({ name: "Barbell Squat Jump", category: "plyometric" })).toBe(true);
    expect(usesE1rm({ name: "Trap Bar Jump", category: "plyometric" })).toBe(true);
    expect(usesE1rm({ name: "Hang Power Clean", category: "ballistic" })).toBe(true);
    expect(usesE1rm({ name: "Back Squat", category: "knee" })).toBe(true);
  });
});
