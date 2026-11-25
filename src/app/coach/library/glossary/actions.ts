"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { coachOnly, str, UUID } from "@/lib/programming/server";

const PATH = "/coach/library/glossary";
function back(error?: string, anchor?: string): never {
  revalidatePath(PATH);
  revalidatePath("/learn");
  redirect(`${PATH}${error ? `?error=${encodeURIComponent(error)}` : ""}${anchor ? `#${anchor}` : ""}`);
}
const slug = (s: string) => s.toLowerCase().replace(/\(.*\)/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const aliasList = (v: FormDataEntryValue | null) =>
  String(v ?? "").split(",").map((a) => a.trim()).filter((a) => a.length >= 2 && a.length <= 30).slice(0, 8);

function fields(fd: FormData) {
  const title = str(fd.get("title"), 80);
  const what = str(fd.get("what"), 2000);
  if (!title || title.length < 2) back("Give the term a name.");
  if (!what) back("Fill in what it is.");
  return { title: title!, what: what!, how: str(fd.get("how"), 2000), why: str(fd.get("why"), 1000), aliases: aliasList(fd.get("aliases")) };
}

export async function addTerm(fd: FormData) {
  const supabase = await coachOnly();
  const f = fields(fd);
  const key = slug(f.title);
  if (key.length < 2) back("Give the term a name.");
  const { error } = await supabase.from("glossary_terms").insert({ ...f, key, aliases: f.aliases.length ? f.aliases : [f.title.replace(/\s*\(.*\)$/, "")], sort_order: 100 });
  back(error ? (/duplicate/.test(error.message) ? "That term already exists." : "That didn't save. Please try again.") : undefined, key);
}

export async function updateTerm(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) back();
  const f = fields(fd);
  const { error } = await supabase.from("glossary_terms").update(f).eq("id", id);
  back(error ? "That didn't save. Please try again." : undefined);
}

export async function deleteTerm(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("glossary_terms").delete().eq("id", id);
  back();
}
