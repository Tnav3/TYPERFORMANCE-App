import data from "./exercise-instructions.json";

/** Written step-by-step instructions, keyed by lower-case exercise name. */
const STEPS = data as Record<string, string>;
export const CUES_MAX = 2000;

/** True when the cues already contain a numbered "1." or "1)" step. */
export function hasSteps(cues: string | null | undefined): boolean {
  return /(^|\n)\s*1[.)]/.test(cues ?? "");
}

export function stepsFor(name: string): string | null {
  return STEPS[name.trim().toLowerCase()] ?? null;
}

/** Steps first, then whatever the coach had already written, kept word for word. */
export function mergeCues(steps: string, existing: string | null | undefined): string | null {
  const note = (existing ?? "").trim();
  const out = note ? `${steps}\n\nCoach notes\n${note}` : steps;
  return out.length <= CUES_MAX ? out : null;
}
