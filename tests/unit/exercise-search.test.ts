import { describe, it, expect } from "vitest";
import { scoreExercise, searchExercises, splitLine } from "@/lib/programming/exercise-search";

const lib = [
  "Back Squat", "Front Squat", "Romanian Deadlift", "Dumbbell Romanian Deadlift", "Bulgarian Split Squat",
  "Barbell Bench Press", "Dumbbell Bench Press", "Single Leg Romanian Deadlift", "Overhead Press", "Pallof Press",
].map((name, i) => ({ id: String(i), name, active: true, category: name.includes("Press") ? "h_press" : "knee" }));
const names = (q: string, o = {}) => searchExercises(lib, q, o).map((e) => e.name);

describe("exercise search", () => {
  it("handles shorthand, partials and typos", () => {
    expect(names("rdl")[0]).toBe("Romanian Deadlift");
    expect(names("db rdl")[0]).toBe("Dumbbell Romanian Deadlift");
    expect(names("bss")).toEqual(["Bulgarian Split Squat"]);
    expect(names("bench")).toEqual(["Barbell Bench Press", "Dumbbell Bench Press"]);
    expect(names("romanain")[0]).toBe("Romanian Deadlift");
    expect(names("sq")[0]).toBe("Back Squat");
    expect(scoreExercise("Back Squat", "zzz")).toBe(0);
  });
  it("recent first, category filter", () => {
    expect(names("", { recent: ["4"] })).toEqual(["Bulgarian Split Squat"]);
    expect(names("press", { category: "h_press" })).not.toContain("Back Squat");
    expect(names("bench", { recent: ["6"] })[0]).toBe("Dumbbell Bench Press");
  });
  it("splits pasted lines", () => {
    const n = lib.map((e) => e.name);
    expect(splitLine("A1. Back Squat 4x6 @80% rest 2m", n)).toEqual({ exercise: "Back Squat", rx: "4x6 @80% rest 2m" });
    expect(splitLine("Nordic curl - 3x5", n)).toEqual({ exercise: "Nordic curl", rx: "3x5" });
    expect(splitLine("Pallof Press", n)).toEqual({ exercise: "Pallof Press", rx: "" });
    expect(splitLine("   ", n)).toBeNull();
  });
});
