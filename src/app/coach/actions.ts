"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AccountStatus } from "@/lib/types";
import { isISODate } from "@/lib/dates";
import { mondayOf } from "@/lib/week";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED: AccountStatus[] = ["active", "inactive"];

// Approve (pending → active), deactivate (→ inactive) or reactivate (→ active).
// The database also enforces coach-only, so this can't be abused from the browser.
export async function setAthleteStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as AccountStatus;
  if (!UUID.test(id) || !ALLOWED.includes(status)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id === id) return; // never change your own account here

  await supabase
    .from("profiles")
    .update({ status })
    .eq("id", id)
    .eq("role", "athlete");
  revalidatePath("/coach");
  revalidatePath(`/coach/athlete/${id}`);
}

export type NoteState = { saved?: boolean; message?: string };

/** Create, update or (when emptied) delete the coach's note for one athlete-week. */
export async function saveCoachNote(
  _prev: NoteState,
  formData: FormData,
): Promise<NoteState> {
  const athlete_id = String(formData.get("athlete_id") ?? "");
  const week_start = String(formData.get("week_start") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const visible_to_athlete = formData.get("visible") === "on";
  if (
    !UUID.test(athlete_id) ||
    !isISODate(week_start) ||
    mondayOf(week_start) !== week_start
  )
    return { message: "Invalid week." };
  if (note.length > 2000)
    return { message: "Keep notes under 2000 characters." };

  const supabase = await createClient();
  const { error } = note
    ? await supabase
        .from("coach_notes")
        .upsert(
          { athlete_id, week_start, note, visible_to_athlete },
          { onConflict: "athlete_id,week_start" },
        )
    : await supabase
        .from("coach_notes")
        .delete()
        .eq("athlete_id", athlete_id)
        .eq("week_start", week_start);
  if (error) return { message: "Couldn't save the note." };
  revalidatePath(`/coach/athlete/${athlete_id}`);
  return { saved: true };
}

const FEATURE_COLUMNS = [
  "feat_checkin",
  "feat_testing",
  "feat_1rm",
  "feat_mas",
] as const;

/** Switch one feature on/off for one athlete. The database only lets the coach do this. */
export async function setAthleteFeature(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const column = String(
    formData.get("column") ?? "",
  ) as (typeof FEATURE_COLUMNS)[number];
  const on = formData.get("on") === "true";
  if (!UUID.test(id) || !FEATURE_COLUMNS.includes(column)) return;

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ [column]: on })
    .eq("id", id)
    .eq("role", "athlete");
  revalidatePath("/coach");
  revalidatePath(`/coach/athlete/${id}`);
}
