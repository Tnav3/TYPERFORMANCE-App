// Ranks swap options for an exercise: same movement pattern first, then the closest match. Pure.
export interface SimilarInput {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  tags: string[] | null;
  measure: string;
  video_url: string | null;
}
const LEVEL = new Set(["beginner", "intermediate", "advanced"]);
const GENERIC = new Set(["compound", "isolation", ...LEVEL]);
export const EQUIPMENT = new Set([
  "barbell", "dumbbell", "kettlebell", "cable", "machine", "bands (loops)", "bands (handles)", "mini band", "plate", "landmine",
  "smith machine", "ez bar", "medicine ball", "slam ball", "suspension", "swiss ball", "sliders", "sled", "box", "bench", "pull up bar", "foam roller",
]);

export function rankSimilar(target: SimilarInput, pool: SimilarInput[], reason?: string | null, limit = 12): SimilarInput[] {
  const tt = new Set(target.tags ?? []);
  const scored = pool
    .filter((e) => e.id !== target.id && e.category === target.category)
    .map((e) => {
      const tags = e.tags ?? [];
      let s = 0;
      if (target.subcategory && e.subcategory === target.subcategory) s += 6;
      if (e.measure === target.measure) s += 1;
      if (e.video_url) s += 1.5;
      for (const t of tags) {
        if (GENERIC.has(t) || !tt.has(t)) continue;
        s += EQUIPMENT.has(t) ? (reason === "equipment" ? -2 : 1) : 1;
      }
      if (reason === "equipment" && tags.includes("body weight")) s += 2;
      if (reason === "too_hard" && tags.includes("beginner")) s += 2;
      if (reason === "too_hard" && tags.includes("advanced")) s -= 2;
      if (reason === "too_easy" && tags.includes("advanced")) s += 2;
      if (reason === "too_easy" && tags.includes("beginner")) s -= 2;
      if (reason === "pain" && /iso|isometric|tempo|supported|assisted/i.test(e.name)) s += 1.5;
      return { e, s };
    })
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name));
  return scored.slice(0, limit).map((x) => x.e);
}
