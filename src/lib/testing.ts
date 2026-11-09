// Test specifications and derived calculations. Pure: unit-tested.
// Formulas:
//  - e1RM from a 3RM: average of Epley [w(1 + r/30)] and Brzycki [w·36/(37 − r)] (spec §7)
//  - MAS (5-min test) = distance / 300 s (Baker 2011, as used in the HIIT manual); target v = MAS × %MAS
//  - Asymmetry % = (stronger − weaker) / stronger × 100
//  - DSI = CMJ peak force / IMTP peak force; <0.60 ballistic deficit, 0.60–0.80 balanced, >0.80 strength deficit

export interface FieldSpec {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number; // input precision
  required?: boolean;
}

export const TEST_FIELDS: Record<string, FieldSpec[]> = {
  med_ball_throw: [
    {
      key: "best_m",
      label: "Best throw",
      unit: "m",
      min: 0.5,
      max: 25,
      step: 0.01,
      required: true,
    },
    {
      key: "ball_kg",
      label: "Ball weight",
      unit: "kg",
      min: 1,
      max: 20,
      step: 0.5,
      required: true,
    },
  ],
  trap_bar_3rm: [
    {
      key: "load_kg",
      label: "3RM load",
      unit: "kg",
      min: 20,
      max: 500,
      step: 0.5,
      required: true,
    },
  ],
  box_squat_3rm: [
    {
      key: "load_kg",
      label: "3RM load",
      unit: "kg",
      min: 20,
      max: 500,
      step: 0.5,
      required: true,
    },
  ],
  bench_3rm: [
    {
      key: "load_kg",
      label: "3RM load",
      unit: "kg",
      min: 20,
      max: 350,
      step: 0.5,
      required: true,
    },
  ],
  chin_ups: [
    {
      key: "reps",
      label: "Clean reps",
      unit: "reps",
      min: 0,
      max: 100,
      step: 1,
      required: true,
    },
  ],
  mas_5min: [
    {
      key: "distance_m",
      label: "Distance in 5 min",
      unit: "m",
      min: 300,
      max: 3000,
      step: 1,
      required: true,
    },
  ],
  mas_bike_5min: [
    {
      key: "distance_km",
      label: "Console distance in 5 min",
      unit: "km",
      min: 0.5,
      max: 5,
      step: 0.01,
      required: true,
    },
  ],
  mas_row_5min: [
    {
      key: "distance_m",
      label: "Monitor distance in 5 min",
      unit: "m",
      min: 300,
      max: 2500,
      step: 1,
      required: true,
    },
  ],
  mas_ski_5min: [
    {
      key: "distance_m",
      label: "Monitor distance in 5 min",
      unit: "m",
      min: 300,
      max: 2500,
      step: 1,
      required: true,
    },
  ],
  broad_jump: [
    {
      key: "best_cm",
      label: "Best jump",
      unit: "cm",
      min: 50,
      max: 400,
      step: 1,
      required: true,
    },
  ],
  triple_hop: [
    {
      key: "left_cm",
      label: "Left leg",
      unit: "cm",
      min: 50,
      max: 1200,
      step: 1,
      required: true,
    },
    {
      key: "right_cm",
      label: "Right leg",
      unit: "cm",
      min: 50,
      max: 1200,
      step: 1,
      required: true,
    },
  ],
  lateral_bound: [
    {
      key: "left_cm",
      label: "Left leg (pushing off)",
      unit: "cm",
      min: 30,
      max: 500,
      step: 1,
      required: true,
    },
    {
      key: "right_cm",
      label: "Right leg (pushing off)",
      unit: "cm",
      min: 30,
      max: 500,
      step: 1,
      required: true,
    },
  ],
  cmj: [
    {
      key: "jump_height_cm",
      label: "Jump height",
      unit: "cm",
      min: 5,
      max: 100,
      step: 0.1,
      required: true,
    },
    {
      key: "peak_force_n",
      label: "Peak propulsive force",
      unit: "N",
      min: 300,
      max: 8000,
      step: 1,
    },
    {
      key: "rsi_mod",
      label: "RSI-mod",
      unit: "",
      min: 0.05,
      max: 2,
      step: 0.01,
    },
  ],
  slj: [
    {
      key: "left_cm",
      label: "Left jump height",
      unit: "cm",
      min: 2,
      max: 70,
      step: 0.1,
      required: true,
    },
    {
      key: "right_cm",
      label: "Right jump height",
      unit: "cm",
      min: 2,
      max: 70,
      step: 0.1,
      required: true,
    },
  ],
  sl_iso_squat: [
    {
      key: "left_n",
      label: "Left peak force",
      unit: "N",
      min: 200,
      max: 6000,
      step: 1,
      required: true,
    },
    {
      key: "right_n",
      label: "Right peak force",
      unit: "N",
      min: 200,
      max: 6000,
      step: 1,
      required: true,
    },
  ],
  imtp: [
    {
      key: "peak_force_n",
      label: "Peak force",
      unit: "N",
      min: 500,
      max: 10000,
      step: 1,
      required: true,
    },
  ],
  plyo_pushup: [
    {
      key: "peak_force_n",
      label: "Peak force",
      unit: "N",
      min: 100,
      max: 4000,
      step: 1,
    },
    {
      key: "height_cm",
      label: "Push-up height",
      unit: "cm",
      min: 1,
      max: 60,
      step: 0.1,
    },
  ],
  rj_10_5: [
    {
      key: "rsi",
      label: "RSI (best 5)",
      unit: "",
      min: 0.2,
      max: 5,
      step: 0.01,
      required: true,
    },
    {
      key: "contact_ms",
      label: "Contact time",
      unit: "ms",
      min: 80,
      max: 600,
      step: 1,
    },
    {
      key: "jump_height_cm",
      label: "Jump height",
      unit: "cm",
      min: 5,
      max: 80,
      step: 0.1,
    },
  ],
};

/** Tests where bodyweight on the day is used (relative strength / force). */
export const USES_BODYWEIGHT = new Set([
  "trap_bar_3rm",
  "box_squat_3rm",
  "bench_3rm",
  "imtp",
]);

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

export function e1rmFrom(load: number, reps = 3): number {
  if (reps <= 1) return load; // spec: a single entered rep IS the 1RM (Epley alone would add 3.3%)
  const epley = load * (1 + reps / 30);
  const brzycki = (load * 36) / (37 - reps);
  return Math.round(((epley + brzycki) / 2) * 2) / 2; // nearest 0.5 kg
}

export function masFrom(distanceM: number) {
  const ms = distanceM / 300;
  return { ms: round(ms, 2), kmh: round(ms * 3.6, 1) };
}

/** Assault Bike: console distance (km) in 5 min → bike MAS. Same maths as the run test. */
export function bikeMasFrom(distanceKm: number) {
  return masFrom(distanceKm * 1000);
}

export const MAS_TARGET_PCTS = [90, 100, 110, 120, 130];
export const MAS_CALC_PCTS = [70, 80, 90, 100, 110, 120, 130];

/** Speed and metres to cover for a given %MAS over 15, 30 and 60 s. */
export function masTargets(masMs: number, pcts: number[] = MAS_TARGET_PCTS) {
  return pcts.map((pct) => {
    const v = masMs * (pct / 100);
    return {
      pct,
      ms: round(v, 2),
      kmh: round(v * 3.6, 1),
      m15: Math.round(v * 15),
      m30: Math.round(v * 30),
      m60: Math.round(v * 60),
    };
  });
}

// ---------- 5-minute MAS tests by modality ----------
export type MasMode = "run" | "bike" | "row" | "ski";

export const MAS_MODES: Record<
  MasMode,
  {
    label: string;
    tab: string;
    testKey: string;
    field: "distance_m" | "distance_km";
    unit: "m" | "km";
    min: number;
    max: number;
    hint: string;
    /** show pace per 500 m (what the Concept2 monitor displays) */
    pace500: boolean;
  }
> = {
  run: { label: "Run", tab: "Run", testKey: "mas_5min", field: "distance_m", unit: "m", min: 300, max: 3000, hint: "Metres covered in 5 minutes", pace500: false },
  bike: { label: "Assault Bike", tab: "Bike", testKey: "mas_bike_5min", field: "distance_km", unit: "km", min: 0.5, max: 5, hint: "Console distance at 5:00", pace500: false },
  row: { label: "Rower", tab: "Row", testKey: "mas_row_5min", field: "distance_m", unit: "m", min: 300, max: 2500, hint: "Monitor distance at 5:00", pace500: true },
  ski: { label: "SkiErg", tab: "SkiErg", testKey: "mas_ski_5min", field: "distance_m", unit: "m", min: 300, max: 2500, hint: "Monitor distance at 5:00", pace500: true },
};
export const MAS_MODE_ORDER: MasMode[] = ["run", "bike", "row", "ski"];

export function masModeOf(testKey: string): MasMode | null {
  return MAS_MODE_ORDER.find((m) => MAS_MODES[m].testKey === testKey) ?? null;
}

/** Distance entered for a mode → MAS (distance ÷ 300 s). */
export function masForMode(mode: MasMode, distance: number) {
  return masFrom(MAS_MODES[mode].unit === "km" ? distance * 1000 : distance);
}

/** MAS (m/s) for any 5-minute test, from its stored values. */
export function masOf(testKey: string, v: Record<string, number>) {
  const mode = masModeOf(testKey);
  if (!mode) return null;
  const d = v[MAS_MODES[mode].field];
  return d ? masForMode(mode, d) : null;
}

/** Concept2-style pace per 500 m, e.g. "1:52.3". */
export function pace500(ms: number): string {
  if (!(ms > 0)) return "—";
  const t = Math.round((500 / ms) * 10) / 10;
  const min = Math.floor(t / 60);
  const sec = t - min * 60;
  return `${min}:${sec.toFixed(1).padStart(4, "0")}`;
}

/** Rep lengths the calculator offers (seconds), up to 4 minutes. */
export const MAS_DURATIONS = [15, 20, 30, 45, 60, 90, 120, 180, 240];
export const durationLabel = (s: number) =>
  s < 60 ? `${s} s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min`;

/** Metres to cover at a speed for a rep length. */
export const repMetres = (ms: number, seconds: number) => Math.round(ms * seconds);

export function asymmetry(left: number, right: number) {
  const hi = Math.max(left, right);
  if (hi <= 0) return null;
  const pct = round(((hi - Math.min(left, right)) / hi) * 100, 1);
  return {
    pct,
    weaker: left === right ? null : left < right ? "left" : "right",
  } as const;
}

export type DsiBand = "ballistic" | "balanced" | "strength";

export function dsiFrom(cmjPeakN: number, imtpPeakN: number) {
  if (!(cmjPeakN > 0) || !(imtpPeakN > 0)) return null;
  const value = round(cmjPeakN / imtpPeakN, 2);
  const band: DsiBand =
    value < 0.6 ? "ballistic" : value > 0.8 ? "strength" : "balanced";
  return { value, band };
}

export const DSI_LABEL: Record<DsiBand, string> = {
  ballistic: "Ballistic deficit (<0.60)",
  balanced: "Balanced (0.60–0.80)",
  strength: "Strength deficit (>0.80)",
};

export interface Derived {
  label: string;
  value: string;
}

/** Human-readable derived numbers for one entry. */
export function derivedFor(
  testKey: string,
  v: Record<string, number>,
  bodyweight: number | null,
): Derived[] {
  const out: Derived[] = [];
  if (testKey.endsWith("_3rm") && v.load_kg) {
    const e = e1rmFrom(v.load_kg);
    out.push({ label: "Est. 1RM", value: `${e} kg` });
    if (bodyweight)
      out.push({
        label: "Relative",
        value: `${round(e / bodyweight, 2)} × BW`,
      });
  }
  const mas = masOf(testKey, v);
  if (mas) {
    out.push({
      label:
        testKey === "mas_5min" ? "MAS" : `${MAS_MODES[masModeOf(testKey)!].label} MAS`,
      value: `${mas.ms} m/s (${mas.kmh} km/h)`,
    });
  }
  if (
    testKey === "triple_hop" ||
    testKey === "lateral_bound" ||
    testKey === "slj" ||
    testKey === "sl_iso_squat"
  ) {
    const l = v.left_cm ?? v.left_n;
    const r = v.right_cm ?? v.right_n;
    const a = l && r ? asymmetry(l, r) : null;
    if (a)
      out.push({
        label: "Asymmetry",
        value: a.weaker ? `${a.pct}% (${a.weaker} weaker)` : "0%",
      });
  }
  if (testKey === "imtp" && v.peak_force_n && bodyweight) {
    out.push({
      label: "Relative",
      value: `${round(v.peak_force_n / bodyweight, 1)} N/kg`,
    });
  }
  return out;
}

/** The single number used to compare entries over time. */
export function headlineValue(
  testKey: string,
  v: Record<string, number>,
): { value: number; unit: string } | null {
  switch (testKey) {
    case "med_ball_throw":
      return v.best_m != null ? { value: v.best_m, unit: "m" } : null;
    case "trap_bar_3rm":
    case "box_squat_3rm":
    case "bench_3rm":
      return v.load_kg != null
        ? { value: e1rmFrom(v.load_kg), unit: "kg e1RM" }
        : null;
    case "chin_ups":
      return v.reps != null ? { value: v.reps, unit: "reps" } : null;
    case "mas_5min":
      return v.distance_m != null
        ? { value: masFrom(v.distance_m).ms, unit: "m/s" }
        : null;
    case "mas_bike_5min":
    case "mas_row_5min":
    case "mas_ski_5min": {
      const m = masOf(testKey, v);
      return m
        ? { value: m.ms, unit: `m/s (${MAS_MODES[masModeOf(testKey)!].tab.toLowerCase()})` }
        : null;
    }
    case "broad_jump":
      return v.best_cm != null ? { value: v.best_cm, unit: "cm" } : null;
    case "triple_hop":
    case "lateral_bound":
      return v.left_cm != null && v.right_cm != null
        ? { value: Math.min(v.left_cm, v.right_cm), unit: "cm (weaker leg)" }
        : null;
    case "cmj":
      return v.jump_height_cm != null
        ? { value: v.jump_height_cm, unit: "cm" }
        : null;
    case "slj":
      return v.left_cm != null && v.right_cm != null
        ? { value: Math.min(v.left_cm, v.right_cm), unit: "cm (weaker leg)" }
        : null;
    case "sl_iso_squat":
      return v.left_n != null && v.right_n != null
        ? { value: Math.min(v.left_n, v.right_n), unit: "N (weaker leg)" }
        : null;
    case "imtp":
      return v.peak_force_n != null
        ? { value: v.peak_force_n, unit: "N" }
        : null;
    case "plyo_pushup":
      return v.peak_force_n != null
        ? { value: v.peak_force_n, unit: "N" }
        : v.height_cm != null
          ? { value: v.height_cm, unit: "cm" }
          : null;
    case "rj_10_5":
      return v.rsi != null ? { value: v.rsi, unit: "RSI" } : null;
  }
  return null;
}

export function pctChange(from: number, to: number): number | null {
  if (!from) return null;
  return round(((to - from) / from) * 100, 1);
}

/** Validates the entered values against the test's field spec. */
export function validateTestValues(
  testKey: string,
  form: { get(name: string): FormDataEntryValue | null },
):
  | { ok: true; values: Record<string, number> }
  | { ok: false; errors: Record<string, string> } {
  const spec = TEST_FIELDS[testKey];
  if (!spec) return { ok: false, errors: { _: "Unknown test" } };
  const values: Record<string, number> = {};
  const errors: Record<string, string> = {};
  for (const f of spec) {
    const raw = String(form.get(f.key) ?? "")
      .trim()
      .replace(",", ".");
    if (raw === "") {
      if (f.required) errors[f.key] = `Enter ${f.label.toLowerCase()}`;
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < f.min || n > f.max) {
      errors[f.key] =
        `Between ${f.min} and ${f.max}${f.unit ? " " + f.unit : ""}`;
      continue;
    }
    if (f.step === 1 && !Number.isInteger(n)) {
      errors[f.key] = "Whole numbers only";
      continue;
    }
    values[f.key] = n;
  }
  if (Object.keys(values).length === 0 && !Object.keys(errors).length)
    errors._ = "Enter at least one result";
  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, values };
}

/** Accepts youtu.be, youtube.com/watch?v=, /shorts/, /embed/ links. Returns the 11-char video id. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
      id = m ? m[2] : null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
