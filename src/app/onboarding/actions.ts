"use server";
import { toColumns } from "@/lib/planned-fights";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CONSENT_VERSION } from "@/lib/consent";
import { validateProfile, type ProfileErrors } from "@/lib/profile-validation";
import { todayISO } from "@/lib/dates";

export async function acceptConsent(formData: FormData) {
  if (formData.get("agree") !== "on") redirect("/onboarding/consent?error=1");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({
      consent_version: CONSENT_VERSION,
      consent_accepted_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) redirect("/onboarding/consent?error=2");
  revalidatePath("/", "layout");
  redirect("/");
}

export type ProfileFormState = {
  errors?: ProfileErrors;
  message?: string;
  saved?: boolean;
};

export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const result = validateProfile(formData, todayISO());
  if (!result.ok) return { errors: result.errors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const d = result.data;
  const { data: before } = await supabase
    .from("profiles")
    .select("profile_completed_at, main_discipline_id, second_fight_date")
    .eq("id", user.id)
    .single();

  // Discipline must exist and be active — unless it's the one they already had
  // (the coach may have hidden it since; keeping it shouldn't block other edits).
  const { data: disc } = await supabase
    .from("disciplines")
    .select("id, active")
    .eq("id", d.main_discipline_id)
    .maybeSingle();
  if (!disc || (!disc.active && disc.id !== before?.main_discipline_id)) {
    return { errors: { main_discipline_id: "Choose your main discipline" } };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: d.full_name,
      main_discipline_id: d.main_discipline_id,
      weight_class: d.weight_class,
      weight_class_limit_kg: d.weight_class_limit_kg,
      // Editing "next fight" here replaces the first planned fight; keep the second in order
      ...toColumns([d.next_fight_date, before?.second_fight_date]),
      training_age_years: d.training_age_years,
      profile_completed_at:
        before?.profile_completed_at ?? new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { message: "Couldn't save. Please try again." };

  revalidatePath("/", "layout");
  // First-time onboarding continues to the next step; edits stay on the page
  if (!before?.profile_completed_at) redirect("/");
  return { saved: true };
}
