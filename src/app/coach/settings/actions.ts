"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Disciplines and session types are never deleted here: hiding keeps old logs intact.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function done(error?: string): never {
  revalidatePath("/coach/settings");
  revalidatePath("/", "layout");
  redirect(
    error
      ? `/coach/settings?error=${encodeURIComponent(error)}`
      : "/coach/settings",
  );
}

function cleanName(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "")
    .trim()
    .replace(/\s+/g, " ");
  return s.length >= 1 && s.length <= 60 ? s : null;
}

function dbError(msg: string): string {
  if (/duplicate|unique/i.test(msg)) return "That name is already used.";
  if (/row-level security/i.test(msg))
    return "Only the coach can change settings.";
  return "Couldn't save. Please try again.";
}

export async function addDiscipline(fd: FormData) {
  const name = cleanName(fd.get("name"));
  if (!name) done("Enter a name (up to 60 characters).");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("disciplines")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("disciplines")
    .insert({ name, sort_order: (last?.sort_order ?? 0) + 1 });
  done(error ? dbError(error.message) : undefined);
}

export async function renameDiscipline(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const name = cleanName(fd.get("name"));
  if (!UUID.test(id) || !name) done("Enter a name (up to 60 characters).");
  const supabase = await createClient();
  const { error } = await supabase
    .from("disciplines")
    .update({ name })
    .eq("id", id);
  done(error ? dbError(error.message) : undefined);
}

export async function setDisciplineActive(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) done();
  const supabase = await createClient();
  const { error } = await supabase
    .from("disciplines")
    .update({ active: fd.get("active") === "true" })
    .eq("id", id);
  done(error ? dbError(error.message) : undefined);
}

export async function addType(fd: FormData) {
  const discipline_id = String(fd.get("discipline_id") ?? "");
  const name = cleanName(fd.get("name"));
  if (!UUID.test(discipline_id) || !name)
    done("Enter a session type name (up to 60 characters).");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("session_types")
    .select("sort_order")
    .eq("discipline_id", discipline_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("session_types")
    .insert({ discipline_id, name, sort_order: (last?.sort_order ?? 0) + 1 });
  done(error ? dbError(error.message) : undefined);
}

export async function renameType(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const name = cleanName(fd.get("name"));
  if (!UUID.test(id) || !name)
    done("Enter a session type name (up to 60 characters).");
  const supabase = await createClient();
  const { error } = await supabase
    .from("session_types")
    .update({ name })
    .eq("id", id);
  done(error ? dbError(error.message) : undefined);
}

export async function setTypeActive(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) done();
  const supabase = await createClient();
  const { error } = await supabase
    .from("session_types")
    .update({ active: fd.get("active") === "true" })
    .eq("id", id);
  done(error ? dbError(error.message) : undefined);
}

/** Move a discipline or a type up/down by renumbering its siblings 1..n. */
export async function move(fd: FormData) {
  const table =
    fd.get("table") === "session_types" ? "session_types" : "disciplines";
  const id = String(fd.get("id") ?? "");
  const dir = fd.get("dir") === "up" ? -1 : 1;
  if (!UUID.test(id)) done();
  const supabase = await createClient();

  let query = supabase
    .from(table)
    .select("id, sort_order, name")
    .order("sort_order")
    .order("name");
  if (table === "session_types") {
    const { data: me } = await supabase
      .from("session_types")
      .select("discipline_id")
      .eq("id", id)
      .maybeSingle();
    if (!me) done();
    query = query.eq("discipline_id", me.discipline_id);
  }
  const { data: list } = await query;
  const ids = (list ?? []).map((r) => r.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) done();
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const results = await Promise.all(
    ids.map((rid, k) =>
      supabase
        .from(table)
        .update({ sort_order: k + 1 })
        .eq("id", rid),
    ),
  );
  const err = results.find((r) => r.error)?.error;
  done(err ? dbError(err.message) : undefined);
}
