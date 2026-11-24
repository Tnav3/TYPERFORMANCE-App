// Check-in forms: when a form is due, and turning submitted fields into stored answers. Pure.
export type Repeat = "once" | "weekly" | "fortnightly" | "monthly";
export type QuestionKind = "short" | "long" | "number" | "scale" | "choice" | "multi" | "yesno";

export interface FormQuestion {
  id: string;
  position: number;
  kind: QuestionKind;
  label: string;
  help: string | null;
  options: string[];
  required: boolean;
}

export const KIND_LABEL: Record<QuestionKind, string> = {
  short: "Short answer",
  long: "Paragraph",
  number: "Number",
  scale: "Scale 1–10",
  choice: "Pick one",
  multi: "Pick any",
  yesno: "Yes / No",
};

export const REPEAT_LABEL: Record<Repeat, string> = {
  once: "Once",
  weekly: "Every week",
  fortnightly: "Every 2 weeks",
  monthly: "Every month",
};

const day = (iso: string) => Date.parse(iso + "T00:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The most recent due date on or before `today`, or null if it hasn't started. */
export function currentDue(a: { repeat: Repeat; starts_on: string }, today: string): string | null {
  if (today < a.starts_on) return null;
  if (a.repeat === "once") return a.starts_on;
  if (a.repeat === "weekly" || a.repeat === "fortnightly") {
    const step = a.repeat === "weekly" ? 7 : 14;
    const days = Math.floor((day(today) - day(a.starts_on)) / 86400000);
    return iso(day(a.starts_on) + Math.floor(days / step) * step * 86400000);
  }
  // monthly: same day of month, clamped to the month's last day
  const [sy, sm, sd] = a.starts_on.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const at = (y: number, m: number) => {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(sd, last)).padStart(2, "0")}`;
  };
  let y = ty;
  let m = tm;
  if (at(y, m) > today) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  const d = at(y, m);
  void td;
  return d < at(sy, sm) ? at(sy, sm) : d;
}

/** Due and not submitted for more than `graceDays` days. */
export function isOverdue(due: string | null, submitted: boolean, today: string, graceDays = 2): boolean {
  if (!due || submitted) return false;
  return (day(today) - day(due)) / 86400000 > graceDays;
}

/** Read answers from submitted form fields (q_<id>), checking required ones. */
export function readAnswers(
  questions: FormQuestion[],
  get: (key: string) => string | null,
  getAll: (key: string) => string[],
): { answers?: Record<string, string | number | boolean | string[]>; error?: string } {
  const out: Record<string, string | number | boolean | string[]> = {};
  for (const q of questions) {
    const key = `q_${q.id}`;
    if (q.kind === "multi") {
      const picked = getAll(key).filter((v) => q.options.includes(v));
      if (picked.length) out[q.id] = picked;
      else if (q.required) return { error: `Answer: ${q.label}` };
      continue;
    }
    const raw = (get(key) ?? "").trim();
    if (!raw) {
      if (q.required) return { error: `Answer: ${q.label}` };
      continue;
    }
    if (q.kind === "number") {
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n) || Math.abs(n) > 100000) return { error: `${q.label}: enter a number` };
      out[q.id] = n;
    } else if (q.kind === "scale") {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 10) return { error: `${q.label}: pick 1–10` };
      out[q.id] = n;
    } else if (q.kind === "yesno") {
      if (raw !== "yes" && raw !== "no") return { error: `${q.label}: pick yes or no` };
      out[q.id] = raw === "yes";
    } else if (q.kind === "choice") {
      if (!q.options.includes(raw)) return { error: `${q.label}: pick an option` };
      out[q.id] = raw;
    } else {
      out[q.id] = raw.slice(0, q.kind === "long" ? 2000 : 200);
    }
  }
  return { answers: out };
}

/** Human-readable answer for the coach. */
export function showAnswer(v: unknown): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  if (Array.isArray(v)) return v.join(", ");
  if (v == null || v === "") return "—";
  return String(v);
}
