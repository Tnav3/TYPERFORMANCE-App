"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/;

export async function setAvatar(path: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (path !== null && (!PATH.test(path) || !path.startsWith(`${user.id}/`))) return { ok: false, error: "That photo didn't save." };
  const { data: before } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) return { ok: false, error: "That photo didn't save. Please try again." };
  if (before?.avatar_path && before.avatar_path !== path) await supabase.storage.from("avatars").remove([before.avatar_path]);
  revalidatePath("/profile");
  revalidatePath("/athlete");
  return { ok: true };
}

const clean = (v: FormDataEntryValue | null, max: number) => {
  const s = String(v ?? "").trim().slice(0, max);
  return s.length ? s : null;
};

export async function saveAboutMe(fd: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase
    .from("profiles")
    .update({ nickname: clean(fd.get("nickname"), 40), goal_text: clean(fd.get("goal_text"), 200), about_me: clean(fd.get("about_me"), 500) })
    .eq("id", user!.id);
  revalidatePath("/profile");
  revalidatePath("/athlete");
  redirect(`/profile?${error ? "error=about" : "saved=about"}#about`);
}
