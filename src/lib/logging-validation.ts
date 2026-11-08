// Validates session and weekly check-in forms. Pure: unit-tested.
import { isLoggableDate, isEditableWeek } from "./week";

type FormLike = { get(name: string): FormDataEntryValue | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: FormDataEntryValue | null) =>
  v == null ? "" : String(v).trim();
function num(v: FormDataEntryValue | null): number | null {
  const s = str(v).replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export interface SessionInput {
  session_date: string;
  start_time: string; // HH:MM
  duration_min: number;
  discipline_id: string;
  session_type_id: string;
  rpe: number;
  notes: string | null;
}
export type SessionErrors = Partial<Record<keyof SessionInput, string>>;

export function validateSession(
  form: FormLike,
  todayISO: string,
): { ok: true; data: SessionInput } | { ok: false; errors: SessionErrors } {
  const e: SessionErrors = {};

  const session_date = str(form.get("session_date"));
  if (!session_date) e.session_date = "Pick a day";
  else if (session_date > todayISO) e.session_date = "Can't log a future day";
  else if (!isLoggableDate(session_date, todayISO))
    e.session_date = "That week is locked";

  const start_time = str(form.get("start_time"));
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(start_time))
    e.start_time = "Enter the time you started";

  const duration = num(form.get("duration_min"));
  if (duration == null) e.duration_min = "Choose how long";
  else if (
    Number.isNaN(duration) ||
    !Number.isInteger(duration) ||
    duration < 5 ||
    duration > 360
  )
    e.duration_min = "Between 5 and 360 minutes";

  const discipline_id = str(form.get("discipline_id"));
  if (!UUID.test(discipline_id)) e.discipline_id = "Choose a discipline";
  const session_type_id = str(form.get("session_type_id"));
  if (!UUID.test(session_type_id)) e.session_type_id = "Choose what you did";

  const rpe = num(form.get("rpe"));
  if (
    rpe == null ||
    Number.isNaN(rpe) ||
    !Number.isInteger(rpe) ||
    rpe < 1 ||
    rpe > 10
  )
    e.rpe = "Rate the session 1–10";

  const notes = str(form.get("notes")) || null;
  if (notes && notes.length > 300) e.notes = "Keep notes under 300 characters";

  if (Object.keys(e).length) return { ok: false, errors: e };
  return {
    ok: true,
    data: {
      session_date,
      start_time: start_time.slice(0, 5),
      duration_min: duration as number,
      discipline_id,
      session_type_id,
      rpe: rpe as number,
      notes,
    },
  };
}

export interface CheckinInput {
  week_start: string;
  wellness: number;
  bodyweight_kg: number | null;
  niggle: boolean;
  niggle_note: string | null;
}
export type CheckinErrors = Partial<Record<keyof CheckinInput, string>>;

export function validateCheckin(
  form: FormLike,
  todayISO: string,
): { ok: true; data: CheckinInput } | { ok: false; errors: CheckinErrors } {
  const e: CheckinErrors = {};
  const week_start = str(form.get("week_start"));
  if (!isEditableWeek(week_start, todayISO))
    e.week_start = "That week can't be edited";

  const wellness = num(form.get("wellness"));
  if (
    wellness == null ||
    Number.isNaN(wellness) ||
    !Number.isInteger(wellness) ||
    wellness < 1 ||
    wellness > 10
  )
    e.wellness = "Rate your week 1–10";

  const bw = num(form.get("bodyweight_kg"));
  let bodyweight_kg: number | null = null;
  if (bw != null) {
    if (Number.isNaN(bw) || bw < 30 || bw > 200)
      e.bodyweight_kg = "Enter kg between 30 and 200";
    else bodyweight_kg = Math.round(bw * 10) / 10;
  }

  const niggle = str(form.get("niggle")) === "yes";
  const noteRaw = str(form.get("niggle_note"));
  const niggle_note = niggle ? noteRaw || null : null;
  if (niggle && !niggle_note)
    e.niggle_note = "Where is it and what does it feel like?";
  if (niggle_note && niggle_note.length > 300)
    e.niggle_note = "Keep it under 300 characters";

  if (Object.keys(e).length) return { ok: false, errors: e };
  return {
    ok: true,
    data: {
      week_start,
      wellness: wellness as number,
      bodyweight_kg,
      niggle,
      niggle_note,
    },
  };
}
