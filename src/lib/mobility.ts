// Mobility Screen: range of motion vs norms. Pure functions: unit-tested.

export type Region = "neck" | "shoulder" | "thoracic" | "hip" | "ankle";

export const REGIONS: { key: Region; title: string }[] = [
  { key: "neck", title: "Neck" },
  { key: "shoulder", title: "Shoulder" },
  { key: "thoracic", title: "Thoracic Spine" },
  { key: "hip", title: "Hip" },
  { key: "ankle", title: "Ankle" },
];

export interface RomMeasure {
  key: string;
  name: string;
  region: Region;
  unit: "deg" | "cm";
  sided: boolean;
  norm: number | null;
  norm_text: string | null;
  asym_pct: number | null;
  asym_abs: number | null;
  self_test: boolean;
  instructions: string | null;
  source: string | null;
  sort_order: number;
  active: boolean;
}

export interface RomEntry {
  id: string;
  athlete_id: string;
  measure_key: string;
  measured_on: string;
  left_value: number | null;
  right_value: number | null;
  value: number | null;
  entered_by: string;
  created_at: string;
}

const num = (x: unknown) => (x == null ? null : Number(x));

/** Postgres numerics arrive as strings. */
export function normaliseMeasure(m: Record<string, unknown>): RomMeasure {
  return {
    ...(m as unknown as RomMeasure),
    norm: num(m.norm),
    asym_pct: num(m.asym_pct),
    asym_abs: num(m.asym_abs),
  };
}
export function normaliseEntry(e: Record<string, unknown>): RomEntry {
  return {
    ...(e as unknown as RomEntry),
    left_value: num(e.left_value),
    right_value: num(e.right_value),
    value: num(e.value),
  };
}

export const unitLabel = (m: Pick<RomMeasure, "unit">) =>
  m.unit === "deg" ? "°" : " cm";
export const fmt = (v: number, m: Pick<RomMeasure, "unit">) =>
  `${Number.isInteger(v) ? v : v.toFixed(1)}${unitLabel(m)}`;

/** Newest entry per measure (by date, then save time). */
export function latestByMeasure(entries: RomEntry[]): Record<string, RomEntry> {
  const out: Record<string, RomEntry> = {};
  for (const e of entries) {
    const cur = out[e.measure_key];
    if (
      !cur ||
      e.measured_on > cur.measured_on ||
      (e.measured_on === cur.measured_on && e.created_at > cur.created_at)
    )
      out[e.measure_key] = e;
  }
  return out;
}

export type RomStatus = "within" | "below" | "no_norm";

export interface RomResult {
  status: RomStatus;
  /** Sides below the norm (sided measures). */
  belowSides: ("left" | "right")[];
  asymmetry: { gap: number; pct: number; weaker: "left" | "right" } | null;
  asymFlag: boolean;
}

/** Compare one entry with its measure's norm and L/R asymmetry rule. */
export function assess(m: RomMeasure, e: RomEntry): RomResult {
  if (!m.sided) {
    const v = e.value ?? 0;
    return {
      status: m.norm == null ? "no_norm" : v >= m.norm ? "within" : "below",
      belowSides: [],
      asymmetry: null,
      asymFlag: false,
    };
  }
  const l = e.left_value ?? 0;
  const r = e.right_value ?? 0;
  const belowSides =
    m.norm == null
      ? []
      : (["left", "right"] as const).filter(
          (s) => (s === "left" ? l : r) < (m.norm as number),
        );
  const gap = Math.round(Math.abs(l - r) * 10) / 10;
  const better = Math.max(Math.abs(l), Math.abs(r));
  const pct = better ? Math.round((gap / better) * 1000) / 10 : 0;
  const asymmetry =
    gap > 0
      ? { gap, pct, weaker: (l < r ? "left" : "right") as "left" | "right" }
      : null;
  const asymFlag =
    !!asymmetry &&
    ((m.asym_abs != null && gap >= m.asym_abs) ||
      (m.asym_abs == null && m.asym_pct != null && pct >= m.asym_pct));
  return {
    status: m.norm == null ? "no_norm" : belowSides.length ? "below" : "within",
    belowSides: [...belowSides],
    asymmetry,
    asymFlag,
  };
}

/**
 * Parse the entry form: fields "<key>_l" / "<key>_r" (sided) or "<key>" (single).
 * A measure with every box blank is skipped; half-filled sided measures are an error.
 */
export function parseRomForm(
  measures: RomMeasure[],
  form: { get(name: string): FormDataEntryValue | null },
):
  | {
      ok: true;
      rows: {
        measure_key: string;
        left_value: number | null;
        right_value: number | null;
        value: number | null;
      }[];
    }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const rows: {
    measure_key: string;
    left_value: number | null;
    right_value: number | null;
    value: number | null;
  }[] = [];
  const read = (name: string) => {
    const t = String(form.get(name) ?? "")
      .trim()
      .replace(",", ".");
    if (t === "") return { blank: true as const };
    const n = Number(t);
    const max = 360;
    return Number.isFinite(n) && n >= -90 && n <= max
      ? { blank: false as const, n: Math.round(n * 10) / 10 }
      : { blank: false as const, n: NaN };
  };
  for (const m of measures) {
    if (m.sided) {
      const l = read(`${m.key}_l`);
      const r = read(`${m.key}_r`);
      if (l.blank && r.blank) continue;
      if (l.blank || r.blank) {
        errors[m.key] = "Enter both sides";
        continue;
      }
      if (
        Number.isNaN(l.n) ||
        Number.isNaN(r.n) ||
        (m.unit === "cm" && (l.n < 0 || r.n < 0))
      ) {
        errors[m.key] = m.unit === "cm" ? "Use 0–360 cm" : "Use −90 to 360°";
        continue;
      }
      rows.push({
        measure_key: m.key,
        left_value: l.n,
        right_value: r.n,
        value: null,
      });
    } else {
      const v = read(m.key);
      if (v.blank) continue;
      if (Number.isNaN(v.n)) {
        errors[m.key] = "Use −90 to 360°";
        continue;
      }
      rows.push({
        measure_key: m.key,
        left_value: null,
        right_value: null,
        value: v.n,
      });
    }
  }
  if (!rows.length && !Object.keys(errors).length)
    errors._ = "Enter at least one measure";
  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, rows };
}
