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
  | "nutrition"
  | "program"
  | "chat"
  | "leaderboard"
  | "habits"
  | "macros"
  | "photos"
  | "bodyweight"
  | "mealplan";

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
  {
    key: "program",
    column: "feat_program",
    label: "Training Program",
    hint: "Today's workout, calendar, logging and exercise history",
  },
  {
    key: "chat",
    column: "feat_chat",
    label: "Chat",
    hint: "Messages with the coach",
  },
  {
    key: "leaderboard",
    column: "feat_leaderboard",
    label: "Leaderboards",
    hint: "Shows their name on group leaderboards",
  },
  {
    key: "bodyweight",
    column: "feat_bodyweight",
    label: "Bodyweight",
    hint: "Daily bodyweight log and trend",
  },
  {
    key: "habits",
    column: "feat_habits",
    label: "Habits",
    hint: "Daily habit checklist set by the coach",
  },
  {
    key: "macros",
    column: "feat_macros",
    label: "Macros",
    hint: "Macro targets and a daily total log",
  },
  {
    key: "photos",
    column: "feat_photos",
    label: "Progress Photos",
    hint: "Private front, side and back photos",
  },
  {
    key: "mealplan",
    column: "feat_mealplan",
    label: "Meal Plan Builder (premium)",
    hint: "Energy/macro calculator and a sample day of eating",
  },
];

/** Coaches always have every feature. Missing columns (older rows) count as on. */
export function hasFeature(
  p: Partial<Profile> | null,
  f: Feature,
): boolean {
  if (!p) return false;
  if (p.role === "coach") return true;
  const col = FEATURES.find((x) => x.key === f)!.column;
  return p[col] !== false;
}

/** Every switchable column. The coach action accepts exactly these, so a new feature can't be missed. */
export const FEATURE_COLUMNS = FEATURES.map((f) => f.column as string);
