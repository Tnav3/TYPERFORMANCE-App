"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { coachOnly, str } from "@/lib/programming/server";
import { slugKey } from "@/lib/programming/categories-data";

const PATH = "/coach/library/categories";
const KEY = /^[a-z][a-z0-9_]{1,29}$/;
function back(error?: string): never {
  revalidatePath(PATH);
  revalidatePath("/coach/library");
  redirect(error ? `${PATH}?error=${encodeURIComponent(error)}` : PATH);
}
const friendly = (m: string) =>
  /foreign key|violates/.test(m) ? "Some exercises still use it. Move them first (Library › tick › Move to category)." : /duplicate/.test(m) ? "That name already exists." : "That didn't save. Please try again.";

export async function addCategory(fd: FormData) {
  const supabase = await coachOnly();
  const label = str(fd.get("label"), 40);
  if (!label) back("Enter a name.");
  const { error } = await supabase.from("exercise_categories").insert({ key: slugKey(label!), label, sort_order: 100 });
  back(error ? friendly(error.message) : undefined);
}

export async function addSubcategory(fd: FormData) {
  const supabase = await coachOnly();
  const category = String(fd.get("category") ?? "");
  const label = str(fd.get("label"), 40);
  if (!KEY.test(category) || !label) back("Enter a name.");
  const { error } = await supabase.from("exercise_subcategories").insert({ category, key: slugKey(label!), label, sort_order: 100 });
  back(error ? friendly(error.message) : undefined);
}

export async function renameCategory(fd: FormData) {
  const supabase = await coachOnly();
  const category = String(fd.get("category") ?? "");
  const sub = String(fd.get("sub") ?? "");
  const label = str(fd.get("label"), 40);
  if (!KEY.test(category) || !label) back("Enter a name.");
  const { error } = sub
    ? await supabase.from("exercise_subcategories").update({ label }).eq("category", category).eq("key", sub)
    : await supabase.from("exercise_categories").update({ label }).eq("key", category);
  back(error ? friendly(error.message) : undefined);
}

export async function deleteCategory(fd: FormData) {
  const supabase = await coachOnly();
  const category = String(fd.get("category") ?? "");
  const sub = String(fd.get("sub") ?? "");
  if (!KEY.test(category)) back();
  const { error } = sub
    ? await supabase.from("exercise_subcategories").delete().eq("category", category).eq("key", sub)
    : await supabase.from("exercise_categories").delete().eq("key", category);
  back(error ? friendly(error.message) : undefined);
}
