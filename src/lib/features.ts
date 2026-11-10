// Per-athlete feature switches, controlled by the coach.
import type { Profile } from "./types";

export type Feature =
  | "checkin"
  | "testing"
  | "1rm"
  | "mas"
  | "rpe"
  | "hr"
  | "fights"
  | "mobility"
  | "nutrition";

export const FEATURES: {
  key: Feature;
  column: keyof Profile;
  label: string;
  hint: string;
}[] = [
  {
    key: "checkin",
    column: "feat_checkin",
    label: "Weekly Check-In",
    hint: "Session logging, wellness, load charts and traffic lights",
  },
  {
    key: "testing",
    column: "feat_testing",
    label: "Testing",
    hint: "Field tests and their results",
  },
  {
    key: "1rm",
    column: "feat_1rm",
    label: "1RM Calculator",
    hint: "e1RM, percentage chart, saved maxes",
  },
  {
    key: "mas",
    column: "feat_mas",
    label: "MAS Calculator",
    hint: "Run, bike, row and SkiErg interval targets",
  },
  {
    key: "rpe",
    column: "feat_rpe",
    label: "RPE & RIR Chart",
    hint: "Reps in reserve and %1RM by reps × RPE",
  },
  {
    key: "hr",
    column: "feat_hr",
    label: "HR Zones",
    hint: "Heart-rate zones with matching RPE",
  },
  {
    key: "fights",
    column: "feat_fights",
    label: "Competition Tracker",
    hint: "Wins, losses, draws and rounds",
  },
  {
    key: "mobility",
    column: "feat_mobility",
    label: "Mobility Screen",
    hint: "Range of motion vs norms, self-tests and your screen",
  },
  {
    key: "nutrition",
    column: "feat_nutrition",
    label: "Nutrition Guide",
    hint: "Daily carb and protein ranges for training and rest days",
  },
];

/** Coaches always have every feature. Missing columns (older rows) count as on. */
export function hasFeature(
  p: Partial<
    Pick<
      Profile,
      | "role"
      | "feat_checkin"
      | "feat_testing"
      | "feat_1rm"
      | "feat_mas"
      | "feat_rpe"
      | "feat_hr"
      | "feat_fights"
      | "feat_mobility"
    >
  > | null,
  f: Feature,
): boolean {
  if (!p) return false;
  if (p.role === "coach") return true;
  const col = FEATURES.find((x) => x.key === f)!.column as "feat_checkin";
  return p[col] !== false;
}

/** Every switchable column. The coach action accepts exactly these, so a new feature can't be missed. */
export const FEATURE_COLUMNS = FEATURES.map((f) => f.column as string);
