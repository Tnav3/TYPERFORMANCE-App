"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { coachOnly, friendly, str, UUID } from "@/lib/programming/server";
import { parseScheme, schemeLoadOf } from "@/lib/programming/schemes";

const go = (q = ""): never => {
  revalidatePath("/coach/library/schemes");
  redirect(`/coach/library/schemes${q}`);
};

export async function saveScheme(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const name = str(fd.get("name"), 60);
  const parsed = parseScheme(String(fd.get("weeks") ?? ""));
  const back = UUID.test(id) ? `?edit=${id}` : "?new=1";
  if (!name || name.length < 2) go(`${back}&error=${encodeURIComponent("Give it a name.")}`);
  if ("error" in parsed) go(`${back}&error=${encodeURIComponent(parsed.error)}`);
  const weeks = (parsed as { weeks: import("@/lib/programming/types").SetTarget[][] }).weeks;
  const row = { name, description: str(fd.get("description"), 300), weeks, load_type: schemeLoadOf(weeks) };
  const { error } = UUID.test(id)
    ? await supabase.from("loading_schemes").update(row).eq("id", id)
    : await supabase.from("loading_schemes").insert(row);
  if (error) go(`${back}&error=${encodeURIComponent(friendly(error.message))}`);
  go();
}

export async function deleteScheme(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("loading_schemes").delete().eq("id", id);
  go();
}
