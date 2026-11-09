// Per-athlete feature switches, controlled by the coach.
import type { Profile } from "./types";

export type Feature = "checkin" | "testing" | "1rm" | "mas";

export const FEATURES: { key: Feature; column: keyof Profile; label: string; hint: string }[] = [
  { key: "checkin", column: "feat_checkin", label: "Weekly Check-In", hint: "Session logging, wellness, load charts and traffic lights" },
  { key: "testing", column: "feat_testing", label: "Testing", hint: "Field tests and their results" },
  { key: "1rm", column: "feat_1rm", label: "1RM Calculator", hint: "e1RM, percentage chart, saved maxes" },
  { key: "mas", column: "feat_mas", label: "MAS Calculator", hint: "Run, bike, row and SkiErg interval targets" },
];

/** Coaches always have every feature. Missing columns (older rows) count as on. */
export function hasFeature(
  p: Partial<Pick<Profile, "role" | "feat_checkin" | "feat_testing" | "feat_1rm" | "feat_mas">> | null,
  f: Feature,
): boolean {
  if (!p) return false;
  if (p.role === "coach") return true;
  const col = FEATURES.find((x) => x.key === f)!.column as "feat_checkin";
  return p[col] !== false;
}
