"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AccountStatus } from "@/lib/types";

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
}
