"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { coachOnly, str, UUID } from "@/lib/programming/server";

const PATH = "/coach/library/habits";
function back(error?: string): never {
  revalidatePath(PATH);
  redirect(error ? `${PATH}?error=${encodeURIComponent(error)}` : PATH);
}

export async function addTemplate(fd: FormData) {
  const supabase = await coachOnly();
  const name = str(fd.get("name"), 80);
  if (!name || name.length < 2) back("Name the habit.");
  const { error } = await supabase.from("habit_templates").insert({ name, details: str(fd.get("details"), 2000), sort_order: 100 });
  back(error ? (/duplicate/.test(error.message) ? "A habit with that name already exists." : "That didn't save. Please try again.") : undefined);
}

export async function updateTemplate(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const name = str(fd.get("name"), 80);
  if (!UUID.test(id)) back();
  if (!name || name.length < 2) back("Name the habit.");
  const { error } = await supabase.from("habit_templates").update({ name, details: str(fd.get("details"), 2000) }).eq("id", id);
  back(error ? "That didn't save. Please try again." : undefined);
}

export async function deleteTemplate(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("habit_templates").delete().eq("id", id);
  back();
}
