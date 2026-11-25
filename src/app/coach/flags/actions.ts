"use server";
import { revalidatePath } from "next/cache";
import { coachOnly, ISO_DATE, str, UUID } from "@/lib/programming/server";

const paths = (id: string) => {
  revalidatePath(`/coach/athlete/${id}/program`);
  revalidatePath(`/coach/athlete/${id}`);
};

export async function addFlag(fd: FormData) {
  const supabase = await coachOnly();
  const athlete = String(fd.get("athlete_id") ?? "");
  const kind = String(fd.get("kind") ?? "");
  const title = str(fd.get("title"), 80);
  const date = String(fd.get("event_date") ?? "");
  if (!UUID.test(athlete) || !["injury", "competition", "note"].includes(kind) || !title || title.length < 2) return;
  await supabase.from("client_flags").insert({ athlete_id: athlete, kind, title, detail: str(fd.get("detail"), 600), event_date: ISO_DATE.test(date) ? date : null });
  paths(athlete);
}

export async function resolveFlag(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const athlete = String(fd.get("athlete_id") ?? "");
  if (!UUID.test(id)) return;
  await supabase.from("client_flags").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id);
  paths(athlete);
}
