import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await freshDb();
});
const g = async (name: string, tags: string[] = []) => ((await db.query<{ e: string[] }>(`select guess_equipment($1, $2) e`, [name, tags])).rows[0].e).join(",");

describe("equipment (062)", () => {
  it("guesses from names and tags", async () => {
    expect(await g("Barbell Bench Press")).toBe("barbell,bench");
    expect(await g("Dumbbell Incline Bench Press")).toBe("bench,dumbbell");
    expect(await g("Back Squat")).toBe("barbell,rack");
    expect(await g("Trap Bar Deadlift")).toBe("trap_bar");
    expect(await g("Miniband Clams")).toBe("mini_band");
    expect(await g("Push Up", ["body weight"])).toBe("");
    expect(await g("Lat Pulldown", ["cable"])).toBe("cable");
    expect(await g("Medball Rotational Scoop Toss")).toBe("med_ball");
  });
  it("new exercises start with a guess; bad keys are refused", async () => {
    const r = await db.query<{ equipment: string[] }>(`insert into exercises (name, category, measure) values ('Test KB Goblet Squat', 'knee', 'load') returning equipment`);
    expect(r.rows[0].equipment).toEqual(["kettlebell"]);
    await expect(db.query(`update exercises set equipment = '{spaceship}' where name = 'Test KB Goblet Squat'`)).rejects.toThrow(/check/);
  });
});
