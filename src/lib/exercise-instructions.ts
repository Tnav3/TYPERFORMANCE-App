import { createHash } from "node:crypto";
import data from "./exercise-instructions.json";
import prevData from "./exercise-instructions-prev.json";
import tipData from "./exercise-tips.json";

/** Written step-by-step instructions, keyed by lower-case exercise name. */
const STEPS = data as Record<string, string>;
/** Short hashes of earlier versions of our written steps, so an improved version can replace them
 *  only when the coach hasn't edited that text since. */
const PREV = prevData as Record<string, string[]>;
/** Extra tips for exercises whose steps the coach wrote, keyed by lower-case name. */
const TIPS = tipData as Record<string, string>;
export const CUES_MAX = 2000;
const NOTES = "\n\nCoach notes\n";

/** True when the cues already contain a numbered "1." or "1)" step. */
export function hasSteps(cues: string | null | undefined): boolean {
  return /(^|\n)\s*1[.)]/.test(cues ?? "");
}
export function hasTip(cues: string | null | undefined): boolean {
  return /(^|\n)\s*(tips?|coaching tips?|key points?|cues?)\s*:?\s*(\n|$)/i.test(cues ?? "");
}

export function stepsFor(name: string): string | null {
  return STEPS[name.trim().toLowerCase()] ?? null;
}

/** Steps first, then whatever the coach had already written, kept word for word. */
export function mergeCues(steps: string, existing: string | null | undefined): string | null {
  const note = (existing ?? "").trim();
  const out = note ? `${steps}${NOTES}${note}` : steps;
  return out.length <= CUES_MAX ? out : null;
}

const short = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);

/** What the cues should become, or null to leave them alone. */
export function planCues(name: string, cues: string | null | undefined): string | null {
  const key = name.trim().toLowerCase();
  const steps = STEPS[key];
  if (!hasSteps(cues)) return steps ? mergeCues(steps, cues) : null;
  const text = cues ?? "";
  // Our own earlier version, untouched by the coach: swap in the improved one, keep their notes.
  if (steps && text.startsWith("Steps\n")) {
    const cut = text.indexOf(NOTES);
    const head = cut === -1 ? text : text.slice(0, cut);
    const tail = cut === -1 ? "" : text.slice(cut);
    if (head !== steps && (PREV[key] ?? []).includes(short(head))) {
      const out = steps + tail;
      return out.length <= CUES_MAX ? out : null;
    }
    return null;
  }
  // The coach's own steps with no tip: add one underneath.
  const tip = TIPS[key];
  if (tip && !hasTip(text)) {
    const out = `${text.trimEnd()}\n\nTip\n${tip}`;
    return out.length <= CUES_MAX ? out : null;
  }
  return null;
}
