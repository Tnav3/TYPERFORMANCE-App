"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { mondayOf, isLoggableDate } from "@/lib/week";
import {
  validateCheckin,
  validateSession,
  type CheckinErrors,
  type SessionErrors,
} from "@/lib/logging-validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Turns database refusals into plain English. */
function dbMessage(msg: string): string {
  if (/locked/i.test(msg)) return "That week is locked (older than 4 weeks).";
  if (/future/i.test(msg)) return "You can't log a future day.";
  if (/foreign key/i.test(msg))
    return "That session type doesn't belong to the discipline. Pick again.";
  if (/row-level security/i.test(msg))
    return "Your account isn't active, so you can't log right now.";
  return "Couldn't save. Please try again.";
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export type SessionFormState = { errors?: SessionErrors; message?: string };

export async function saveSession(
  _prev: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const today = todayISO();
  const v = validateSession(formData, today);
  if (!v.ok) return { errors: v.errors };
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const d = v.data;

  // Existing row (edit) — must be yours
  let existingTypeId: string | null = null;
  if (id) {
    if (!UUID.test(id)) return { message: "Session not found." };
    const { data: ex } = await supabase
      .from("training_sessions")
      .select("session_type_id, session_date")
      .eq("id", id)
      .eq("athlete_id", user.id)
      .maybeSingle();
    if (!ex) return { message: "Session not found." };
    if (!isLoggableDate(ex.session_date, today))
      return { message: "That week is locked (older than 4 weeks)." };
    existingTypeId = ex.session_type_id;
  }

  // Type must be active (or the one already saved, if the coach has since hidden it)
  const { data: st } = await supabase
    .from("session_types")
    .select("id, active, discipline_id")
    .eq("id", d.session_type_id)
    .maybeSingle();
  if (
    !st ||
    st.discipline_id !== d.discipline_id ||
    (!st.active && st.id !== existingTypeId)
  ) {
    return { errors: { session_type_id: "Choose what you did" } };
  }

  const row = { ...d };
  const { error } = id
    ? await supabase
        .from("training_sessions")
        .update(row)
        .eq("id", id)
        .eq("athlete_id", user.id)
    : await supabase
        .from("training_sessions")
        .insert({ ...row, athlete_id: user.id });
  if (error) return { message: dbMessage(error.message) };

  const week = mondayOf(d.session_date);
  revalidatePath(`/week/${week}`);
  revalidatePath("/athlete");
  redirect(`/week/${week}?saved=1`);
}

export async function deleteSession(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const week = String(formData.get("week") ?? "");
  if (!UUID.test(id)) redirect("/");
  const { supabase, user } = await requireUser();
  await supabase
    .from("training_sessions")
    .delete()
    .eq("id", id)
    .eq("athlete_id", user.id);
  revalidatePath(`/week/${week}`);
  revalidatePath("/athlete");
  redirect(`/week/${week}?deleted=1`);
}

export type CheckinFormState = {
  errors?: CheckinErrors;
  message?: string;
  saved?: boolean;
};

export async function saveCheckin(
  _prev: CheckinFormState,
  formData: FormData,
): Promise<CheckinFormState> {
  const v = validateCheckin(formData, todayISO());
  if (!v.ok) return { errors: v.errors };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("weekly_checkins")
    .upsert(
      { ...v.data, athlete_id: user.id },
      { onConflict: "athlete_id,week_start" },
    );
  if (error) return { message: dbMessage(error.message) };
  revalidatePath(`/week/${v.data.week_start}`);
  revalidatePath("/athlete");
  return { saved: true };
}
