// What each exercise collects, unit handling, and canonical storage.
// Canonical: weight kg, time seconds, distance metres, speed km/h (shown as m/s by default), height cm.

export const FIELD_KEYS = [
  "reps",
  "weight",
  "time",
  "distance",
  "speed",
  "watts",
  "calories",
  "heart_rate",
  "rpe",
  "height",
  "velocity",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export const FIELD_LABEL: Record<FieldKey, string> = {
  reps: "Reps",
  weight: "Weight",
  time: "Time",
  distance: "Distance",
  speed: "Speed",
  watts: "Watts",
  calories: "Calories",
  heart_rate: "Heart rate",
  rpe: "RPE",
  height: "Height",
  velocity: "Bar speed (VBT)",
};

export interface Units {
  weight_unit: "kg" | "lb";
  distance_unit: "m" | "km" | "mi";
  speed_unit: "ms" | "kmh" | "mph";
}

export const DEFAULT_UNITS: Units = { weight_unit: "kg", distance_unit: "m", speed_unit: "ms" };

const BY_MEASURE: Record<string, FieldKey[]> = {
  load: ["reps", "weight"],
  bodyweight: ["reps", "weight"],
  time: ["time"],
  distance: ["distance"],
  calories: ["calories"],
};

export function fieldsFor(ex: { fields?: string[] | null; measure: string }, line?: { fields?: string[] | null } | null): FieldKey[] {
  const f = ((line?.fields?.length ? line.fields : ex.fields) ?? []).filter((x): x is FieldKey => (FIELD_KEYS as readonly string[]).includes(x));
  return f.length ? f.slice(0, 4) : BY_MEASURE[ex.measure] ?? ["reps", "weight"];
}

export function unitLabel(field: FieldKey, u: Units, bodyweight = false): string {
  switch (field) {
    case "weight":
      return `${bodyweight ? "+" : ""}${u.weight_unit}`;
    case "time":
      return "sec";
    case "distance":
      return u.distance_unit;
    case "speed":
      return u.speed_unit === "mph" ? "mph" : u.speed_unit === "kmh" ? "km/h" : "m/s";
    case "calories":
      return "cal";
    case "heart_rate":
      return "bpm";
    case "height":
      return "cm";
    case "watts":
      return "W";
    case "velocity":
      return "m/s";
    default:
      return field === "reps" ? "reps" : "";
  }
}

const LB = 0.45359237;
const MI = 1609.344;
const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Display value → canonical number (null if blank/invalid). Time accepts "1:30". */
export function toCanonical(field: FieldKey, raw: string, u: Units): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  let n: number;
  if (field === "time" && s.includes(":")) {
    const parts = s.split(":").map(Number);
    if (parts.some((p) => !Number.isFinite(p))) return null;
    n = parts.reduce((a, p) => a * 60 + p, 0);
  } else n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  switch (field) {
    case "weight":
      return round(u.weight_unit === "lb" ? n * LB : n, 2);
    case "distance":
      return round(u.distance_unit === "km" ? n * 1000 : u.distance_unit === "mi" ? n * MI : n, 1);
    case "speed":
      return round(u.speed_unit === "mph" ? n * (MI / 1000) : u.speed_unit === "kmh" ? n : n * 3.6, 2);
    case "velocity":
      return round(n, 2);
    case "reps":
    case "watts":
    case "calories":
    case "heart_rate":
      return Math.round(n);
    default:
      return round(n, 1);
  }
}

/** Canonical number → display string in the exercise's units. */
export function fromCanonical(field: FieldKey, v: number | null | undefined, u: Units): string {
  if (v == null || !Number.isFinite(v)) return "";
  switch (field) {
    case "weight":
      return String(u.weight_unit === "lb" ? Math.round((v / LB) * 2) / 2 : round(v, 2));
    case "distance":
      return String(u.distance_unit === "km" ? round(v / 1000, 2) : u.distance_unit === "mi" ? round(v / MI, 2) : round(v, 0));
    case "speed":
      return String(u.speed_unit === "mph" ? round(v / (MI / 1000), 1) : u.speed_unit === "kmh" ? round(v, 1) : round(v / 3.6, 2));
    case "velocity":
      return String(round(v, 2));
    default:
      return String(round(v, 1));
  }
}

/** Suggested load in display units (lb rounds to 5 lb). */
export function suggestedDisplayWeight(kg: number | null, u: Units): string {
  if (kg == null) return "";
  return u.weight_unit === "lb" ? String(Math.round(kg / LB / 5) * 5) : String(kg);
}

/** The single "value" column keeps the main timed metric so older views still work. */
export function primaryValue(metrics: Partial<Record<FieldKey, number | null>>): number | null {
  return metrics.time ?? metrics.distance ?? metrics.calories ?? null;
}

/** "5 × 100 kg", "12 cal · 0:45 · 310 W", etc. for history/feeds. */
export function describeSet(
  s: { reps: number | null; load_kg: number | null; metrics?: Record<string, number | null> | null; value?: number | null },
  fields: FieldKey[],
  u: Units,
): string {
  const m = { ...(s.metrics ?? {}) } as Record<string, number | null>;
  const parts: string[] = [];
  for (const f of fields) {
    if (f === "reps" && s.reps != null) parts.push(`${s.reps}`);
    else if (f === "weight" && s.load_kg != null) parts.push(`${fromCanonical("weight", s.load_kg, u)} ${u.weight_unit}`);
    else if (f === "time" && (m.time ?? (fields[0] === "time" ? s.value : null)) != null) {
      const t = Number(m.time ?? s.value);
      parts.push(t >= 60 ? `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}` : `${t}s`);
    } else if (f !== "reps" && f !== "weight" && f !== "time") {
      const v = m[f] ?? (fields[0] === f ? s.value ?? null : null);
      if (v != null) parts.push(`${fromCanonical(f, Number(v), u)} ${unitLabel(f, u)}`);
    }
  }
  return fields[0] === "reps" && fields[1] === "weight" && parts.length === 2 ? `${parts[0]} × ${parts[1]}` : parts.join(" · ");
}
