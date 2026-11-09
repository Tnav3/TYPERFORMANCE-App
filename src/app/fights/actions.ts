"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { validateFight } from "@/lib/fights";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FightState = {
  errors?: Record<string, string>;
  message?: string;
  saved?: boolean;
};

export async function saveFight(
  _prev: FightState,
  fd: FormData,
): Promise<FightState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const requested = String(fd.get("athlete_id") ?? "");
  const athleteId = UUID.test(requested) ? requested : user.id;
  const date = String(fd.get("fought_on") ?? "");
  const result = String(fd.get("result") ?? "");
  const rounds = Number(String(fd.get("rounds") ?? "").trim() || NaN);
  const errors = validateFight({ date, result, rounds, today: todayISO() });
  if (Object.keys(errors).length) return { errors };

  const { error } = await supabase
    .from("fights")
    .insert({ athlete_id: athleteId, fought_on: date, result, rounds });
  if (error)
    return {
      message: /switched off/i.test(error.message)
        ? "Fight Record is switched off for your account."
        : /row-level security/i.test(error.message)
          ? "Your account isn't active, so this can't be saved."
          : "Couldn't save. Please try again.",
    };

  // The fight they'd planned has happened: clear it so they can enter the next one
  await supabase
    .from("profiles")
    .update({ next_fight_date: null })
    .eq("id", athleteId)
    .lte("next_fight_date", date);

  revalidatePath("/fights");
  revalidatePath("/athlete");
  revalidatePath(`/coach/athlete/${athleteId}/fights`);
  revalidatePath("/coach/fights");
  return { saved: true };
}

export async function deleteFight(fd: FormData) {
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const next = String(fd.get("next") ?? "/fights");
  if (UUID.test(id)) await supabase.from("fights").delete().eq("id", id);
  revalidatePath(next);
  revalidatePath("/coach/fights");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/fights");
}
