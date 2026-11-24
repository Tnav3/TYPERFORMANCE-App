// Works out the client's e1RM for an exercise and the kg to show for a line.
import type { Lift } from "@/lib/calculator";
import type { LiftMax } from "@/lib/lift-data";
import { roundLoad } from "@/lib/prescription";

/** Newest saved e1RM per lift key. Expects maxes newest-first (as getMaxes returns). */
export function latestByLift(maxes: Pick<LiftMax, "lift_key" | "e1rm_kg">[]) {
  const m = new Map<string, number>();
  for (const x of maxes) if (!m.has(x.lift_key)) m.set(x.lift_key, Number(x.e1rm_kg));
  return m;
}

/**
 * e1RM that a % prescription is based on. Jumps/throws use their parent lift.
 * Bodyweight lifts store a system e1RM (bodyweight + added); `bodyweightLift` tells the caller.
 */
export function baseFor(
  liftKey: string | null,
  lifts: Map<string, Pick<Lift, "key" | "kind" | "parent_key">>,
  latest: Map<string, number>,
): { e1rm: number; bodyweightLift: boolean } | null {
  if (!liftKey) return null;
  const lift = lifts.get(liftKey);
  if (!lift) return null;
  const key = lift.kind === "jump" ? lift.parent_key : lift.key;
  const e = key ? latest.get(key) : undefined;
  if (!e) return null;
  const parent = key ? lifts.get(key) : undefined;
  return { e1rm: e, bodyweightLift: (parent ?? lift).kind === "bodyweight" };
}

/**
 * Suggested kg for one line (rounded to 2.5 kg).
 * Bodyweight lifts return the ADDED load (system load minus bodyweight), never below 0.
 */
export function lineLoad(
  item: { load_type: string; percent: number | string | null; load_kg: number | string | null },
  base: { e1rm: number; bodyweightLift: boolean } | null,
  bodyweight: number | null,
): { kg: number; addedToBodyweight: boolean } | null {
  if (item.load_type === "kg" && item.load_kg != null)
    return { kg: Number(item.load_kg), addedToBodyweight: false };
  if (item.load_type !== "percent" || item.percent == null || !base) return null;
  const system = (Number(item.percent) / 100) * base.e1rm;
  if (base.bodyweightLift) {
    if (bodyweight == null) return null;
    return { kg: Math.max(0, roundLoad(system - bodyweight)), addedToBodyweight: true };
  }
  // A % line with a kg cap ("75% 100kg") never suggests above the cap
  const cap = item.load_kg != null ? Number(item.load_kg) : Infinity;
  return { kg: Math.min(cap, roundLoad(system)), addedToBodyweight: false };
}
