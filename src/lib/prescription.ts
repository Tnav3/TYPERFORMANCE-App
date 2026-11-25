// Prescription lines: one-line entry ("4x5 @ 80%"), display, and load calculation.
// Pure functions so they can be unit-tested.

export type LoadType = "percent" | "rpe" | "kg" | "bodyweight" | "velocity" | "none";

export interface Prescription {
  sets: number | null;
  reps: string | null;
  load_type: LoadType;
  percent: number | null;
  rpe: number | null;
  load_kg: number | null;
  velocity: number | null;
  tempo: string | null;
  rest_sec: number | null;
  notes: string | null;
}

export const EMPTY: Prescription = {
  sets: null,
  reps: null,
  load_type: "none",
  percent: null,
  rpe: null,
  load_kg: null,
  velocity: null,
  tempo: null,
  rest_sec: null,
  notes: null,
};

const n = (s: string) => Number(s.replace(",", "."));

/**
 * Parses a one-line prescription. Recognised pieces are removed; anything left
 * over becomes notes so nothing typed is ever lost.
 *   4x5 @ 80%        3x8 RPE 7        3x10 @ 40kg       3x8-10
 *   3xAMRAP          5x3 @ 80% tempo 30X1 rest 3m       3x30s   BW
 */
export function parsePrescription(input: string): Prescription {
  const out: Prescription = { ...EMPTY };
  let s = ` ${input.trim()} `;

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (m) {
      fn(m);
      s = s.replace(m[0], " ");
    }
  };

  // sets x reps  (reps may be a number, a range, AMRAP, or a time like 30s)
  take(
    /\s(\d{1,2})\s*[x×*]\s*(amrap|max|\d{1,4}\s*-\s*\d{1,4}|\d{1,4}\s*(?:s|sec|secs|m|min|cal|e\/s|\/side|ea)?)(?=[\s@,]|$)/i,
    (m) => {
      out.sets = Math.min(20, Math.max(1, Number(m[1])));
      const r = m[2].replace(/\s+/g, "").toLowerCase();
      out.reps =
        r === "amrap" || r === "max"
          ? r.toUpperCase()
          : r.replace(/secs?$/, "s").replace(/mins?$/, "min");
    },
  );
  if (out.sets === null)
    take(/\s(\d{1,2})\s*sets?(?=\s|$)/i, (m) => {
      out.sets = Math.min(20, Math.max(1, Number(m[1])));
    });
  // RPE
  take(/\s@?\s*rpe\s*(\d{1,2}(?:[.,]5)?)(?=\s|$)/i, (m) => {
    out.load_type = "rpe";
    out.rpe = Math.min(10, Math.max(1, n(m[1])));
  });
  // target bar speed (VBT): "0.7 m/s", "@0.7m/s", "0.7ms"
  take(/\s@?\s*(\d(?:[.,]\d{1,2})?)\s*m\/?s(?=\s|$)/i, (m) => {
    out.velocity = Math.min(3, Math.max(0.1, n(m[1])));
    if (out.load_type === "none") out.load_type = "velocity";
  });
  // percent
  take(/\s@?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%(?:\s*1rm)?/i, (m) => {
    out.load_type = out.load_type === "rpe" ? "rpe" : "percent";
    out.percent = Math.min(120, Math.max(1, n(m[1])));
  });
  // kg
  take(/\s@?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*kgs?(?=\s|$)/i, (m) => {
    if (out.load_type === "none" || out.load_type === "velocity") out.load_type = "kg";
    out.load_kg = Math.min(600, n(m[1]));
  });
  // bodyweight
  take(/\s@?\s*(bw|bodyweight)(?=\s|$)/i, () => {
    if (out.load_type === "none" || out.load_type === "velocity") out.load_type = "bodyweight";
  });
  // tempo
  take(/\stempo\s*([0-9xX]{3,4})(?=\s|$)/i, (m) => {
    out.tempo = m[1].toUpperCase();
  });
  // rest: "rest 90s", "rest 3m", "rest 2:30", "rest 2min"
  take(/\srest\s*(\d{1,2}):(\d{2})(?=\s|$)/i, (m) => {
    out.rest_sec = Number(m[1]) * 60 + Number(m[2]);
  });
  take(/\srest\s*(\d{1,4})\s*(s|sec|secs|m|min|mins)?(?=\s|$)/i, (m) => {
    const v = Number(m[1]);
    const unit = (m[2] ?? (v <= 10 ? "m" : "s")).toLowerCase();
    out.rest_sec = unit.startsWith("m") ? v * 60 : v;
  });
  if (out.rest_sec !== null) out.rest_sec = Math.min(1800, out.rest_sec);

  const left = s.replace(/\s*[@,]\s*/g, " ").replace(/\s+/g, " ").trim();
  out.notes = left || null;
  return out;
}

const trimNum = (v: number) => String(Number(v.toFixed(2)));

/** "4 × 5 @ 80%", "3 × 8 @ RPE 7", "3 × 10 @ 40 kg", "4 × 6" */
export function formatPrescription(p: Partial<Prescription>): string {
  const parts: string[] = [];
  if (p.sets && p.reps) parts.push(`${p.sets} × ${p.reps}`);
  else if (p.sets) parts.push(`${p.sets} sets`);
  else if (p.reps) parts.push(String(p.reps));
  const pct = p.percent != null ? Number(p.percent) : null;
  const rpe = p.rpe != null ? Number(p.rpe) : null;
  const kg = p.load_kg != null ? Number(p.load_kg) : null;
  if (p.load_type === "percent" && pct != null) parts.push(`@ ${trimNum(pct)}%`);
  else if (p.load_type === "rpe" && rpe != null) parts.push(`@ RPE ${trimNum(rpe)}`);
  else if (p.load_type === "kg" && kg != null) parts.push(`@ ${trimNum(kg)} kg`);
  else if (p.load_type === "bodyweight") parts.push("@ BW");
  const vel = p.velocity != null ? Number(p.velocity) : null;
  if (vel != null) parts.push(p.load_type === "velocity" ? `@ ${trimNum(vel)} m/s` : `${trimNum(vel)} m/s`);
  if (p.tempo) parts.push(`tempo ${p.tempo}`);
  if (p.rest_sec) parts.push(`rest ${formatRest(Number(p.rest_sec))}`);
  return parts.join(" ");
}

export function formatRest(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return r ? `${m}:${String(r).padStart(2, "0")}` : `${m} min`;
}

/** Round to the nearest 2.5 kg (standard plate jumps). */
export const roundLoad = (kg: number) => Math.round(kg / 2.5) * 2.5;

/**
 * Suggested load for one prescription line.
 * percent → % of e1RM; kg → the kg; otherwise null (RPE and bodyweight are felt, not calculated).
 */
export function suggestedLoad(
  p: Pick<Prescription, "load_type" | "percent" | "load_kg">,
  e1rm: number | null,
): number | null {
  if (p.load_type === "kg" && p.load_kg != null) return Number(p.load_kg);
  if (p.load_type === "percent" && p.percent != null && e1rm)
    return roundLoad((Number(p.percent) / 100) * e1rm);
  return null;
}

/** Same e1RM formula as the calculator (average of Epley and Brzycki, nearest 0.5 kg). */
export function e1rm(load: number, reps: number): number {
  if (reps <= 1) return Math.round(load * 2) / 2;
  if (reps > 12) return NaN; // too many reps to estimate reliably
  return (
    Math.round(((load * (1 + reps / 30) + (load * 36) / (37 - reps)) / 2) * 2) /
    2
  );
}

/** Number of sets to show for logging: the prescription's sets, else 1. */
export const setCount = (sets: number | null) => Math.max(1, sets ?? 1);

/** First number in a reps text: "8-10" → 8, "5" → 5, "AMRAP" → null. */
export function targetReps(reps: string | null): number | null {
  const m = reps?.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Superset label like "A1", or "A" when the block has one exercise. */
export function itemLabel(
  item: { block: string; slot: number },
  blockSize: number,
): string {
  return blockSize > 1 ? `${item.block}${item.slot}` : item.block;
}

/** Per-set plan, e.g. "5 @ 75% · 4 @ 80% · 3 @ 85%". Collapses identical sets: "3 × 8 @ RPE 7". */
export function formatSetPlan(plan: { r: string; p?: number; e?: number; k?: number }[] | null | undefined): string {
  if (!plan?.length) return "";
  const one = (x: { r: string; p?: number; e?: number; k?: number }) =>
    `${x.r}${x.p != null ? ` @ ${trimNum(x.p)}%` : x.e != null ? ` @ RPE ${trimNum(x.e)}` : x.k != null ? ` @ ${trimNum(x.k)} kg` : ""}`;
  const parts = plan.map(one);
  return parts.every((x) => x === parts[0]) ? `${plan.length} × ${parts[0]}` : parts.join(" · ");
}
