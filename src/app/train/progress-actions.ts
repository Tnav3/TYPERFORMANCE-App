"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { todayISO } from "@/lib/dates";
import { dec, friendly, int, ISO_DATE, signedIn, UUID } from "@/lib/programming/server";

/** Save a logged top set as the client's e1RM for the linked calculator lift. */
export async function saveSetAsMax(fd: FormData) {
  const { supabase, user } = await signedIn();
  const exerciseId = String(fd.get("exercise_id") ?? "");
  const back = `/train/history/${exerciseId}`;
  const kg = dec(fd.get("kg"));
  const reps = int(fd.get("reps"));
  if (!UUID.test(exerciseId) || !kg || !reps || reps < 1 || reps > 10) redirect(`${back}?error=${encodeURIComponent("Only sets of 1–10 reps can be saved as a 1RM.")}`);
  const { data: ex } = await supabase
    .from("exercises")
    .select("lift_key, lifts(kind)")
    .eq("id", exerciseId)
    .maybeSingle();
  const kind = (ex?.lifts as unknown as { kind: string } | null)?.kind;
  if (!ex?.lift_key || !kind || kind === "jump") redirect(`${back}?error=${encodeURIComponent("This exercise isn't linked to a 1RM lift.")}`);
  let bw: number | null = null;
  if (kind === "bodyweight") {
    const { data } = await supabase
      .from("body_metrics")
      .select("weight_kg")
      .eq("athlete_id", user.id)
      .order("measured_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    bw = data ? Number(data.weight_kg) : null;
    if (bw == null) redirect(`${back}?error=${encodeURIComponent("Log your bodyweight first.")}`);
  }
  const { error } = await supabase.from("lift_maxes").insert({
    athlete_id: user.id,
    lift_key: ex!.lift_key,
    load_kg: kg,
    reps,
    bodyweight_kg: bw,
    e1rm_kg: 0,
  });
  revalidatePath(back);
  revalidatePath("/calculator");
  redirect(error ? `${back}?error=${encodeURIComponent(friendly(error.message))}` : `${back}?saved=1`);
}

export async function saveBodyweight(fd: FormData) {
  const { supabase, user } = await signedIn();
  const kg = dec(fd.get("kg"));
  const waist = dec(fd.get("waist"));
  const date = String(fd.get("date") ?? todayISO());
  if (!kg || kg < 30 || kg > 250) redirect(`/bodyweight?error=${encodeURIComponent("Enter a weight between 30 and 250 kg.")}`);
  if (!ISO_DATE.test(date)) redirect("/bodyweight");
  const { error } = await supabase
    .from("body_metrics")
    .upsert(
      { athlete_id: user.id, measured_on: date, weight_kg: kg, waist_cm: waist && waist >= 40 && waist <= 200 ? waist : null },
      { onConflict: "athlete_id,measured_on" },
    );
  revalidatePath("/bodyweight");
  redirect(error ? `/bodyweight?error=${encodeURIComponent(friendly(error.message))}` : "/bodyweight?saved=1");
}

export async function deleteBodyweight(fd: FormData) {
  const { supabase, user } = await signedIn();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("body_metrics").delete().eq("id", id).eq("athlete_id", user.id);
  revalidatePath("/bodyweight");
  redirect("/bodyweight");
}

/** One-tap weigh-in from the home screen. */
export async function quickWeight(kgRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const kg = Number(String(kgRaw).replace(",", "."));
  if (!Number.isFinite(kg) || kg < 30 || kg > 250) return { ok: false, error: "Enter a weight between 30 and 250 kg." };
  const { supabase, user } = await signedIn();
  const { error } = await supabase
    .from("body_metrics")
    .upsert({ athlete_id: user.id, measured_on: todayISO(), weight_kg: Math.round(kg * 10) / 10 }, { onConflict: "athlete_id,measured_on" });
  revalidatePath("/athlete");
  revalidatePath("/bodyweight");
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}
