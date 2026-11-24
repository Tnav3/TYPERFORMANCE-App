// Equipment an exercise needs. Keys match exercises_equipment_check (migration 062).
export const EQUIPMENT_LIST = [
  ["barbell", "Barbell"],
  ["dumbbell", "Dumbbells"],
  ["kettlebell", "Kettlebell"],
  ["plate", "Weight plate"],
  ["bench", "Bench"],
  ["rack", "Squat rack"],
  ["trap_bar", "Trap bar"],
  ["ez_bar", "EZ bar"],
  ["ssb", "Safety squat bar"],
  ["smith", "Smith machine"],
  ["landmine", "Landmine"],
  ["cable", "Cable machine"],
  ["machine", "Machine"],
  ["pullup_bar", "Pull-up bar"],
  ["suspension", "TRX / rings"],
  ["ghd", "GHD"],
  ["box", "Box / step"],
  ["band", "Resistance band"],
  ["mini_band", "Mini band"],
  ["med_ball", "Medicine ball"],
  ["slam_ball", "Slam ball"],
  ["swiss_ball", "Swiss ball"],
  ["sliders", "Sliders"],
  ["foam_roller", "Foam roller"],
  ["hurdles", "Hurdles / cones"],
  ["sled", "Sled"],
  ["jump_rope", "Skipping rope"],
  ["bag", "Heavy bag"],
  ["bike", "Bike"],
  ["rower", "Rower"],
  ["skierg", "SkiErg"],
  ["treadmill", "Treadmill"],
] as const;
export type EquipmentKey = (typeof EQUIPMENT_LIST)[number][0];
export const EQUIPMENT_KEYS = EQUIPMENT_LIST.map((e) => e[0]) as readonly string[];
const LABEL = new Map<string, string>(EQUIPMENT_LIST);
export const equipmentLabel = (k: string) => LABEL.get(k) ?? k;

/** Everything a workout needs, in list order, counted by how many exercises use it. */
export function neededFor(lists: (string[] | null | undefined)[]): { key: string; label: string; n: number }[] {
  const n = new Map<string, number>();
  for (const l of lists) for (const k of new Set(l ?? [])) n.set(k, (n.get(k) ?? 0) + 1);
  return EQUIPMENT_LIST.filter(([k]) => n.has(k)).map(([k, label]) => ({ key: k, label, n: n.get(k)! }));
}
