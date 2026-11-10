export type UserRole = "coach" | "athlete";
export type AccountStatus = "pending" | "active" | "inactive";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: AccountStatus;
  main_discipline_id: string | null;
  weight_class: string | null;
  weight_class_limit_kg: number | string | null; // Postgres numeric arrives as string
  next_fight_date: string | null; // YYYY-MM-DD
  training_age_years: number | string | null;
  profile_completed_at: string | null;
  consent_version: string | null;
  consent_accepted_at: string | null;
  feat_checkin: boolean;
  feat_testing: boolean;
  feat_1rm: boolean;
  feat_mas: boolean;
  feat_rpe: boolean;
  feat_hr: boolean;
  feat_fights: boolean;
  feat_mobility: boolean;
  feat_nutrition: boolean;
  second_fight_date: string | null;
  sex: "male" | "female" | null;
  created_at: string;
  updated_at: string;
}

export interface Discipline {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}
