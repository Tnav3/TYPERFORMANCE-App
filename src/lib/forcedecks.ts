// Every ForceDecks test the coach can pick for a testing day. The six original battery tests
// keep their keys (cmj, slj, sl_iso_squat, imtp, plyo_pushup, rj_10_5); the rest are extra.
import type { FieldSpec } from "./testing";

export type FdTest = { key: string; name: string; abbr: string; group: "Jumps" | "Hops & landings" | "Isometrics" | "Upper body" | "Balance" };

const f = (key: string, label: string, unit: string, min: number, max: number, step: number, required = false): FieldSpec =>
  ({ key, label, unit, min, max, step, ...(required ? { required: true } : {}) });
const lr = (base: string, label: string, unit: string, min: number, max: number, step: number): FieldSpec[] => [
  f(`left_${base}`, `Left ${label}`, unit, min, max, step, true),
  f(`right_${base}`, `Right ${label}`, unit, min, max, step, true),
];

/** Field specs for the ForceDecks tests added after the original battery. */
export const FD_EXTRA_FIELDS: Record<string, FieldSpec[]> = {
  abcmj: [f("jump_height_cm", "Jump height", "cm", 5, 110, 0.1, true), f("peak_power_w", "Peak power", "W", 500, 12000, 1)],
  lcmj: [f("jump_height_cm", "Jump height", "cm", 2, 90, 0.1, true), f("load_kg", "Load", "kg", 1, 200, 0.5, true), f("peak_force_n", "Peak propulsive force", "N", 300, 9000, 1)],
  cmrj: [f("jump_height_cm", "Jump height", "cm", 5, 100, 0.1, true), f("rsi", "RSI", "", 0.1, 5, 0.01)],
  sj: [f("jump_height_cm", "Jump height", "cm", 5, 100, 0.1, true), f("peak_force_n", "Peak force", "N", 300, 8000, 1)],
  lsj: [f("jump_height_cm", "Jump height", "cm", 2, 90, 0.1, true), f("load_kg", "Load", "kg", 1, 200, 0.5, true)],
  dj: [f("box_height_cm", "Box height", "cm", 10, 100, 1, true), f("rsi", "RSI", "", 0.1, 5, 0.01, true), f("jump_height_cm", "Jump height", "cm", 5, 100, 0.1), f("contact_ms", "Contact time", "ms", 80, 1000, 1)],
  sldj: [f("box_height_cm", "Box height", "cm", 5, 60, 1, true), ...lr("rsi", "RSI", "", 0.05, 4, 0.01)],
  slcmrj: lr("cm", "jump height", "cm", 2, 70, 0.1),
  hj: [f("rsi", "RSI", "", 0.2, 5, 0.01, true), f("contact_ms", "Contact time", "ms", 80, 600, 1)],
  slhj: lr("rsi", "RSI", "", 0.1, 4, 0.01),
  slhar: lr("rsi", "RSI", "", 0.1, 4, 0.01),
  lah: [f("peak_landing_bw", "Peak landing force", "× BW", 0.5, 15, 0.01, true), f("ttsb_ms", "Time to stabilise", "ms", 50, 5000, 1)],
  sllah: lr("landing_bw", "peak landing force", "× BW", 0.5, 15, 0.01),
  sqt: [f("asym_pct", "Left-right asymmetry", "%", 0, 60, 0.1, true), f("depth_cm", "Squat depth", "cm", 5, 100, 0.1)],
  iso_squat: [f("peak_force_n", "Peak force", "N", 500, 12000, 1, true)],
  iso_belt_squat: [f("peak_force_n", "Peak force", "N", 500, 12000, 1, true)],
  iso_hamstring: lr("n", "peak force", "N", 50, 1500, 1),
  iso_pushup: [f("peak_force_n", "Peak force", "N", 100, 4000, 1, true)],
  ash: [...lr("i_n", "I peak force", "N", 20, 1000, 1), f("left_y_n", "Left Y peak force", "N", 20, 1000, 1), f("right_y_n", "Right Y peak force", "N", 20, 1000, 1), f("left_t_n", "Left T peak force", "N", 20, 1000, 1), f("right_t_n", "Right T peak force", "N", 20, 1000, 1)],
  quiet_stand: [f("cop_area_mm2", "Sway area", "mm²", 1, 5000, 0.1, true)],
  sl_stand: lr("cop_mm2", "sway area", "mm²", 1, 10000, 0.1),
};

/** All ForceDecks tests in picker order. */
export const FD_TESTS: FdTest[] = [
  { key: "cmj", name: "Countermovement jump", abbr: "CMJ", group: "Jumps" },
  { key: "abcmj", name: "Abalakov jump (arm swing)", abbr: "ABCMJ", group: "Jumps" },
  { key: "lcmj", name: "Loaded countermovement jump", abbr: "LCMJ", group: "Jumps" },
  { key: "cmrj", name: "Countermovement rebound jump", abbr: "CMRJ", group: "Jumps" },
  { key: "sj", name: "Squat jump", abbr: "SJ", group: "Jumps" },
  { key: "lsj", name: "Loaded squat jump", abbr: "LSJ", group: "Jumps" },
  { key: "slj", name: "Single leg jump", abbr: "SLJ", group: "Jumps" },
  { key: "slcmrj", name: "Single leg rebound jump", abbr: "SLCMRJ", group: "Jumps" },
  { key: "dj", name: "Drop jump", abbr: "DJ", group: "Hops & landings" },
  { key: "sldj", name: "Single leg drop jump", abbr: "SLDJ", group: "Hops & landings" },
  { key: "rj_10_5", name: "10-5 repeated jump", abbr: "10/5", group: "Hops & landings" },
  { key: "hj", name: "Hop test", abbr: "HJ", group: "Hops & landings" },
  { key: "slhj", name: "Single leg hop test", abbr: "SLHJ", group: "Hops & landings" },
  { key: "slhar", name: "Single leg hop and return", abbr: "SLHAR", group: "Hops & landings" },
  { key: "lah", name: "Land and hold", abbr: "LAH", group: "Hops & landings" },
  { key: "sllah", name: "Single leg land and hold", abbr: "SLLAH", group: "Hops & landings" },
  { key: "imtp", name: "Isometric mid-thigh pull", abbr: "IMTP", group: "Isometrics" },
  { key: "iso_squat", name: "Isometric squat", abbr: "ISOSQT", group: "Isometrics" },
  { key: "sl_iso_squat", name: "Single leg isometric squat", abbr: "SLISOSQT", group: "Isometrics" },
  { key: "iso_belt_squat", name: "Isometric belt squat", abbr: "ISOBS", group: "Isometrics" },
  { key: "iso_hamstring", name: "Single leg hamstring isometric", abbr: "SLISOH", group: "Isometrics" },
  { key: "sqt", name: "Squat assessment", abbr: "SQT", group: "Isometrics" },
  { key: "plyo_pushup", name: "Plyometric push-up", abbr: "PPU", group: "Upper body" },
  { key: "iso_pushup", name: "Isometric push-up", abbr: "ISOPU", group: "Upper body" },
  { key: "ash", name: "Athletic shoulder test (I/Y/T)", abbr: "ASH", group: "Upper body" },
  { key: "quiet_stand", name: "Quiet stand", abbr: "QS", group: "Balance" },
  { key: "sl_stand", name: "Single leg stand", abbr: "SLS", group: "Balance" },
];
export const FD_KEYS = new Set(FD_TESTS.map((t) => t.key));
export const FD_DEFAULT = ["cmj", "slj", "sl_iso_squat", "imtp", "plyo_pushup", "rj_10_5"];

/** Lower numbers are better for these (sway, asymmetry, landing force). */
export const LOWER_IS_BETTER = new Set(["sqt", "lah", "sllah", "quiet_stand", "sl_stand"]);

/** Headline for the extra tests: weaker side for left/right tests, otherwise the first required field. */
export function fdHeadline(key: string, v: Record<string, number>): { value: number; unit: string } | null {
  const spec = FD_EXTRA_FIELDS[key];
  if (!spec) return null;
  const first = spec[0];
  if (first.key.startsWith("left_")) {
    const base = first.key.slice(5);
    const l = v[`left_${base}`];
    const r = v[`right_${base}`];
    if (l == null || r == null) return null;
    const worse = LOWER_IS_BETTER.has(key) ? Math.max(l, r) : Math.min(l, r);
    return { value: worse, unit: `${first.unit ? first.unit + " " : ""}(weaker side)`.trim() };
  }
  const val = v[first.key];
  return val == null ? null : { value: val, unit: first.unit || first.label };
}
