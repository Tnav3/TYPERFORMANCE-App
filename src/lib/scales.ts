// Session RPE uses Foster's CR-10 scale, with plain-English labels so athletes
// can pick without thinking. Load (AU) = RPE × duration in minutes.
export const RPE_LABELS: Record<number, { label: string; hint: string }> = {
  1: { label: "Very easy", hint: "Barely working" },
  2: { label: "Easy", hint: "Could do this all day" },
  3: { label: "Moderate", hint: "Comfortable, steady" },
  4: { label: "Somewhat hard", hint: "Starting to work" },
  5: { label: "Hard", hint: "Breathing hard, still in control" },
  6: { label: "Hard+", hint: "Tough but sustainable" },
  7: { label: "Very hard", hint: "Had to push to finish" },
  8: { label: "Very hard+", hint: "Only a little left in the tank" },
  9: { label: "Near max", hint: "Almost everything I had" },
  10: { label: "Max effort", hint: "Nothing left" },
};

// Weekly wellness: 1 = awful, 10 = great
export function wellnessLabel(n: number): string {
  if (n <= 2) return "Awful";
  if (n <= 4) return "Poor";
  if (n <= 6) return "OK";
  if (n <= 8) return "Good";
  return "Great";
}

export const DURATION_PRESETS = [30, 45, 60, 75, 90, 120];

export function sessionLoad(rpe: number, minutes: number): number {
  return rpe * minutes;
}
