"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { addPlanned, removePlanned } from "@/lib/planned-fights";

export type PlannedState = { error?: string; ok?: number };

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase
    .from("profiles")
    .select("next_fight_date, second_fight_date")
    .eq("id", user.id)
    .single();
  return { supabase, id: user.id, p: p ?? { next_fight_date: null, second_fight_date: null } };
}

export async function addPlannedFight(_prev: PlannedState, fd: FormData): Promise<PlannedState> {
  const { supabase, id, p } = await me();
  const next = addPlanned(p, String(fd.get("date") ?? ""), todayISO());
  if ("error" in next) return { error: next.error };
  const { error } = await supabase.from("profiles").update(next).eq("id", id);
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/athlete");
  return { ok: Date.now() };
}

export async function removePlannedFight(fd: FormData) {
  const { supabase, id, p } = await me();
  await supabase.from("profiles").update(removePlanned(p, String(fd.get("date") ?? ""))).eq("id", id);
  revalidatePath("/athlete");
}
