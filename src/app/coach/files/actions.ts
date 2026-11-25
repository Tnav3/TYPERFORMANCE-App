"use server";
import { revalidatePath } from "next/cache";
import { coachOnly, UUID } from "@/lib/programming/server";

/** Records a file the browser just uploaded to the coach-files bucket. */
export async function addCoachFile(input: { name: string; path: string; mime: string; size: number }): Promise<{ ok: boolean; error?: string }> {
  if (!/^library\/[A-Za-z0-9._-]+$/.test(input.path)) return { ok: false, error: "Upload failed." };
  const supabase = await coachOnly();
  const { error } = await supabase.from("coach_files").insert({
    name: input.name.trim().slice(0, 120) || "File",
    path: input.path,
    mime: input.mime.slice(0, 80),
    size: Math.max(1, Math.round(input.size)),
  });
  revalidatePath("/coach/files");
  return error ? { ok: false, error: "That didn't save." } : { ok: true };
}

export async function deleteCoachFile(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await coachOnly();
  const { data } = await supabase.from("coach_files").select("path").eq("id", id).maybeSingle();
  await supabase.from("coach_files").delete().eq("id", id);
  if (data?.path) await supabase.storage.from("coach-files").remove([data.path]);
  revalidatePath("/coach/files");
}
