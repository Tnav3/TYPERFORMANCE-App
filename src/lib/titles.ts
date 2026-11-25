// Titles and belts shown on the player card. Text badges only: no third-party logos.
export const TITLE_COLOURS = {
  gold: { label: "Gold", cls: "bg-gradient-to-b from-yellow-200 to-amber-500 text-black" },
  silver: { label: "Silver", cls: "bg-gradient-to-b from-slate-100 to-slate-400 text-black" },
  green: { label: "Green", cls: "bg-gradient-to-b from-emerald-500 to-emerald-800 text-white" },
  red: { label: "Red", cls: "bg-gradient-to-b from-[#e8333b] to-[#8c0d14] text-white" },
  blue: { label: "Blue", cls: "bg-gradient-to-b from-sky-500 to-blue-800 text-white" },
  purple: { label: "Purple", cls: "bg-gradient-to-b from-violet-500 to-purple-900 text-white" },
  black: { label: "Black", cls: "bg-gradient-to-b from-zinc-600 to-black text-white" },
} as const;
export type TitleColour = keyof typeof TITLE_COLOURS;

/** Suggestions for the organisation box (any text is allowed). */
export const TITLE_ORGS = ["WBC", "WBA", "IBF", "WBO", "IBO", "ISKA", "WKA", "WKN", "IKF", "WMC", "IFMA", "WAKO", "ANBF", "State", "National", "Regional"];

export interface Title {
  id: string;
  org: string;
  name: string | null;
  colour: TitleColour;
  won_on: string | null;
}

export function validateTitle(i: { org: string; name: string; colour: string; won_on: string; today: string }) {
  const org = i.org.trim().replace(/\s+/g, " ");
  const name = i.name.trim().replace(/\s+/g, " ");
  if (org.length < 2 || org.length > 20) return { error: "Organisation needs 2 to 20 characters (e.g. WBC, ISKA)." };
  if (name.length > 60) return { error: "Keep the title under 60 characters." };
  if (i.won_on && (!/^\d{4}-\d{2}-\d{2}$/.test(i.won_on) || i.won_on > i.today)) return { error: "Pick the date it was won (not in the future)." };
  const colour = (i.colour in TITLE_COLOURS ? i.colour : "gold") as TitleColour;
  return { row: { org, name: name || null, colour, won_on: i.won_on || null } };
}

/** Heaviest single set someone has lifted (kg), with the exercise. */
export function heaviestLift(sets: { kg: number | null; reps: number | null; key: string }[]): { kg: number; exercise_id: string } | null {
  let best: { kg: number; exercise_id: string } | null = null;
  for (const s of sets) {
    if (s.kg == null || !(s.reps ?? 0)) continue;
    if (!best || s.kg > best.kg) best = { kg: s.kg, exercise_id: s.key };
  }
  return best;
}
