"use server";
import { revalidatePath } from "next/cache";
import { coachOnly } from "@/lib/programming/server";
import { TOUR_KEYS } from "@/lib/tutorial";

export async function saveTourVideos(fd: FormData) {
  const supabase = await coachOnly();
  for (const k of TOUR_KEYS) {
    const url = String(fd.get(k) ?? "").trim();
    if (!url) await supabase.from("tour_videos").delete().eq("key", k);
    else if (/^https:\/\/\S{4,290}$/.test(url)) await supabase.from("tour_videos").upsert({ key: k, url, updated_at: new Date().toISOString() });
  }
  revalidatePath("/coach/tour");
}
