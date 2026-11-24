import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await freshDb();
});
const cls = async (name: string, tags: string[] = [], old: string | null = "strength") =>
  ((await db.query<{ c: string[] }>(`select classify_exercise($1, $2, $3) c`, [name, tags, old])).rows[0].c).join(".");

describe("movement patterns (056)", () => {
  it("sorts by name", async () => {
    const cases: [string, string, string?][] = [
      ["Barbell Bench Press", "h_press.barbell"],
      ["Dumbbell Incline Bench Press", "h_press.dumbbell"],
      ["Hand Release Push Up", "h_press.push_up"],
      ["Intensive Half Kneeling Medball Rotational Slam - Continuous", "ballistic.throw_rot", "plyometric"],
      ["Med Ball Chest Pass", "ballistic.throw_chest", "power"],
      ["Overhead Medball Throw to Wall", "ballistic.throw_oh", "power"],
      ["Hang Power Clean", "ballistic.olympic", "power"],
      ["Lateral Hurdle Hop - Continuous", "ballistic.bounds", "plyometric"],
      ["Counter Movement Jump (CMJ)", "ballistic.jumps", "plyometric"],
      ["Heel Elevated Goblet Squat", "knee.squat"],
      ["Rear Foot Elevated (RFE) Split Squat + Cable Row - Single Arm", "knee.lunge"],
      ["Patrick Step Up", "knee.step_up"],
      ["Hand Supported Single Leg RDL", "hip.single_leg"],
      ["Landmine Hip Thrust", "hip.thrust"],
      ["Deficit Sumo Deadlift", "hip.hinge"],
      ["Nordic Hamstring Curl", "hip.curl"],
      ["Barbell Pendlay Row", "h_pull.rows"],
      ["Underhand Grip Cable Lat Pulldown", "v_pull.pulldown"],
      ["Towel Chin Up", "v_pull.pull_up"],
      ["Tall Kneeling Landmine Press - Double Arm", "v_press.landmine"],
      ["Half Kneeling Cable Pallof Press", "core.anti_rot", "core"],
      ["Standing Cable Rotations", "core.rotation"],
      ["Side Plank Top Leg Lift", "core.lateral", "core"],
      ["Hollow Hold Kicks", "core.anti_ext", "core"],
      ["Dumbbell Strict Curl", "accessory.arms"],
      ["Plate Neck Lateral Flexion", "accessory.neck"],
      ["Assault Bike", "cond_mob.conditioning", "conditioning"],
      ["Band Hamstring Stretch", "cond_mob.stretch", "mobility"],
    ];
    const wrong: string[] = [];
    for (const [n, want, old] of cases) {
      const got = await cls(n, [], old ?? "strength");
      if (got !== want) wrong.push(`${n}: ${got} (want ${want})`);
    }
    expect(wrong).toEqual([]);
  });
  it("old-style inserts are sorted automatically", async () => {
    const r = await db.query<{ category: string; subcategory: string }>(
      `insert into exercises (name, category, measure) values ('Test Zercher Squat', 'strength', 'load') returning category, subcategory`,
    );
    expect(r.rows[0]).toEqual({ category: "knee", subcategory: "squat" });
    const m = await db.query<{ subcategory: string | null }>(`update exercises set category = 'hip' where name = 'Test Zercher Squat' returning subcategory`);
    expect(m.rows[0].subcategory).toBeNull();
  });
});
