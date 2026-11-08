// Validates the athlete profile form (spec §4). Pure: unit-tested.
import { daysBetween, isISODate } from "./dates";

export interface ProfileInput {
  full_name: string;
  main_discipline_id: string;
  competing: boolean;
  weight_class: string | null;
  weight_class_limit_kg: number | null;
  next_fight_date: string | null;
  training_age_years: number;
}

export type ProfileErrors = Partial<Record<keyof ProfileInput, string>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function num(v: FormDataEntryValue | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function str(v: FormDataEntryValue | null | undefined): string {
  return v == null ? "" : String(v).trim();
}

export function validateProfile(
  form: { get(name: string): FormDataEntryValue | null },
  todayISO: string
): { ok: true; data: ProfileInput } | { ok: false; errors: ProfileErrors } {
  const errors: ProfileErrors = {};

  const full_name = str(form.get("full_name")).replace(/\s+/g, " ");
  if (full_name.length < 2) errors.full_name = "Enter your name";
  else if (full_name.length > 80) errors.full_name = "Name is too long";

  const main_discipline_id = str(form.get("main_discipline_id"));
  if (!UUID.test(main_discipline_id)) errors.main_discipline_id = "Choose your main discipline";

  const competing = str(form.get("competing")) === "yes";

  let weight_class: string | null = null;
  let weight_class_limit_kg: number | null = null;
  let next_fight_date: string | null = null;

  if (competing) {
    weight_class = str(form.get("weight_class")) || null;
    if (!weight_class) errors.weight_class = "Enter your weight class";
    else if (weight_class.length > 40) errors.weight_class = "Keep it under 40 characters";

    const kg = num(form.get("weight_class_limit_kg"));
    if (kg == null) errors.weight_class_limit_kg = "Enter the weight limit in kg";
    else if (Number.isNaN(kg) || kg < 30 || kg > 200) errors.weight_class_limit_kg = "Enter a limit between 30 and 200 kg";
    else weight_class_limit_kg = Math.round(kg * 100) / 100;

    const fd = str(form.get("next_fight_date"));
    if (fd) {
      if (!isISODate(fd)) errors.next_fight_date = "Enter a valid date";
      else {
        const d = daysBetween(todayISO, fd);
        if (d < 0) errors.next_fight_date = "Fight date is in the past";
        else if (d > 730) errors.next_fight_date = "Fight date is more than 2 years away";
        else next_fight_date = fd;
      }
    }
  }

  const ta = num(form.get("training_age_years"));
  let training_age_years = 0;
  if (ta == null) errors.training_age_years = "Enter your training age";
  else if (Number.isNaN(ta) || ta < 0 || ta > 60) errors.training_age_years = "Enter a number between 0 and 60";
  else training_age_years = Math.round(ta * 2) / 2; // nearest half year

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      full_name,
      main_discipline_id,
      competing,
      weight_class,
      weight_class_limit_kg,
      next_fight_date,
      training_age_years,
    },
  };
}
