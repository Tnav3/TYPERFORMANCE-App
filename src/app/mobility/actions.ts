"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { parseRomForm } from "@/lib/mobility";
import { getRomMeasures } from "@/lib/mobility-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type RomState = {
  errors?: Record<string, string>;
  message?: string;
  saved?: number;
};

export async function saveRom(
  _prev: RomState,
  fd: FormData,
): Promise<RomState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const requested = String(fd.get("athlete_id") ?? "");
  const athleteId = UUID.test(requested) ? requested : user.id;
  const date = String(fd.get("measured_on") ?? "");
  if (!DATE.test(date) || date > todayISO())
    return { errors: { measured_on: "Pick a date that isn't in the future" } };

  // Only the measures this form showed (self-tests for clients)
  const only = String(fd.get("scope") ?? "") === "self";
  const measures = (await getRomMeasures(supabase)).filter(
    (m) => !only || m.self_test,
  );
  const parsed = parseRomForm(measures, fd);
  if (!parsed.ok) return { errors: parsed.errors };

  const { error } = await supabase
    .from("rom_entries")
    .insert(
      parsed.rows.map((r) => ({
        ...r,
        athlete_id: athleteId,
        measured_on: date,
      })),
    );
  if (error)
    return {
      message: /switched off/i.test(error.message)
        ? "Mobility Screen is switched off for your account."
        : /Only your coach/i.test(error.message)
          ? "Only your coach can enter those measures."
          : /row-level security/i.test(error.message)
            ? "Your account isn't active, so this can't be saved."
            : "Couldn't save. Please try again.",
    };

  revalidatePath("/mobility");
  revalidatePath(`/coach/athlete/${athleteId}/mobility`);
  return { saved: parsed.rows.length };
}

export async function deleteRom(fd: FormData) {
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const next = String(fd.get("next") ?? "/mobility");
  if (UUID.test(id)) await supabase.from("rom_entries").delete().eq("id", id);
  const safe =
    next.startsWith("/") && !next.startsWith("//") ? next : "/mobility";
  revalidatePath(safe);
  redirect(safe);
}
