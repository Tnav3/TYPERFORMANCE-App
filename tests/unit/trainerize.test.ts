import { describe, it, expect } from "vitest";
import { parseRx, parseWorkout } from "@/lib/import/trainerize";

const ankle = `Phase 2 - Ankle Sprain
Phase 2 - Ankle Sprain
Protocols - Ankle Rehab
Regular workout
Created by Tyrell Navarro on 11 Mar 2025, last updated on 11 Mar 2025.
est. 27 minutes
Equipment
Bench
Instructions
Guidelines
- Perform 3 to 4 days a week
Band Inversion
3 sets x 15 e/s - Control the return back to your starting position
Rest 30 sec between sets
Superset of 3 sets
Elevated Bodyweight Calf Raise
10-15 reps - Controlled lower
Miniband Clams - Single leg
10-20 e/s - Do not let your knee cave in as you push out.
Rest for 60 sec
Repeat new set
Lateral Step Down
3 sets x 8-12 e/s
Band Inversion
1. Tie a band around your foot.`;

const bike = `AERO PWR - SHORT/LONG.1
Cardiac Power
Regular workout
est. 22 minutes
Instructions
For the warm-up aim to complete the distance.
Assault Bike
1 set x 3 min, Complete 1km ride within 3 minutes at a steady pace.
Rest 60 sec between sets
Assault Bike
3 sets x 20 sec each, MAS 110% - Distance to cover:
Rest 20 sec between sets
Rest for 3 min
Assault Bike
2 sets x 2 min each, MAS 100% -Distance to cover:
Rest 2 min between sets
Assault Bike
Sit on the bike and adjust the seat.`;

describe("Trainerize import", () => {
  it("reads prescriptions", () => {
    expect(parseRx("3 sets x 30-60 sec")).toEqual({ sets: 3, reps: "30-60s", notes: null });
    expect(parseRx("1 set x 1-2 minutes e/s")).toEqual({ sets: 1, reps: "1-2 min e/s", notes: null });
    expect(parseRx("10-15 reps - Controlled lower")).toEqual({ sets: null, reps: "10-15", notes: "Controlled lower" });
  });
  it("parses a rehab workout with a superset", () => {
    const w = parseWorkout(ankle);
    expect(w.tag).toBe("Protocols - Ankle Rehab");
    expect(w.minutes).toBe(27);
    expect(w.instructions).toBe("Guidelines\n- Perform 3 to 4 days a week");
    expect(w.items.map((x) => `${x.block}${x.slot} ${x.exercise} ${x.sets}x${x.reps} r${x.rest_sec}`)).toEqual([
      "A1 Band Inversion 3x15 e/s r30",
      "B1 Elevated Bodyweight Calf Raise 3x10-15 rnull",
      "B2 Miniband Clams - Single leg 3x10-20 e/s r60",
      "C1 Lateral Step Down 3x8-12 e/s rnull",
    ]);
  });
  it("reads bare rep counts but not numbered steps", () => {
    const w = parseWorkout(`X\nTag\nRegular workout\nInstructions\nGo\nSuperset of 3 sets\nCat to Cow\n10-15 - Focus on moving your spine\nDowel Flexion\n10-15 on injured side.\nRest for 90 sec\nCat to Cow\n1. Get on all fours.\n2. Arch.`);
    expect(w.items.map((x) => `${x.block}${x.slot} ${x.exercise} ${x.sets}x${x.reps}`)).toEqual(["A1 Cat to Cow 3x10-15", "A2 Dowel Flexion 3x10-15"]);
  });
  it("keeps repeated exercises (conditioning)", () => {
    const w = parseWorkout(bike);
    expect(w.items.length).toBe(3);
    expect(w.items[1]).toMatchObject({ exercise: "Assault Bike", sets: 3, reps: "20s", rest_sec: 20, notes: "MAS 110% - Distance to cover: Then rest 3 min before the next exercise." });
    expect(w.items[2]).toMatchObject({ sets: 2, reps: "2 min", rest_sec: 120 });
  });
});
