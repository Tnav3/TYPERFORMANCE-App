/** Should this exercise show an estimated 1RM?
 *  Not for bodyweight, med ball or dumbbell jumps, pogos, bounds and throws:
 *  the number means nothing there. Barbell and trap bar jumps and the
 *  Olympic lifts keep it. */
const HEAVY_BAR = /\b(barbell|trap ?bar|hex ?bar|hammer strength|smith)/i;
const THROWN = /(med ?ball|dead ?ball|wall ball|slam|throw|toss|shot ?put|chest pass|wall pass)/i;
const JUMPY = /(jump|pogo|\bhop|bound|skip|plyo|landing|drop catch)/i;

export function usesE1rm(ex: { name: string; category?: string | null }): boolean {
  const n = ex.name ?? "";
  if (THROWN.test(n)) return false;
  if (ex.category === "plyometric" || JUMPY.test(n)) return HEAVY_BAR.test(n);
  return true;
}
