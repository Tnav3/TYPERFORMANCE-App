"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/programming/server";

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, uid: data.user?.id ?? null };
}

/** Setup note on one exercise. Blank deletes it. */
export async function setExerciseNote(exerciseId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(exerciseId)) return { ok: false, error: "Not found." };
  const { supabase, uid } = await me();
  if (!uid) return { ok: false, error: "Sign in again." };
  const text = body.trim().slice(0, 1000);
  const { error } = text
    ? await supabase.from("client_notes").upsert({ athlete_id: uid, exercise_id: exerciseId, body: text, updated_at: new Date().toISOString() }, { onConflict: "athlete_id,exercise_id" })
    : await supabase.from("client_notes").delete().eq("athlete_id", uid).eq("exercise_id", exerciseId);
  revalidatePath("/notes");
  return error ? { ok: false, error: "Couldn't save. Try again." } : { ok: true };
}

export async function addNote(fd: FormData) {
  const { supabase, uid } = await me();
  const body = String(fd.get("body") ?? "").trim().slice(0, 1000);
  const title = String(fd.get("title") ?? "").trim().slice(0, 80) || null;
  const id = String(fd.get("id") ?? "");
  if (!uid || !body) return;
  if (UUID.test(id)) await supabase.from("client_notes").update({ title, body, updated_at: new Date().toISOString() }).eq("id", id);
  else await supabase.from("client_notes").insert({ athlete_id: uid, title, body });
  revalidatePath("/notes");
}

export async function deleteNote(fd: FormData) {
  const { supabase } = await me();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("client_notes").delete().eq("id", id);
  revalidatePath("/notes");
}
