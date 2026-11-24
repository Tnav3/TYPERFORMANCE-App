"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { coachOnly, friendly, ISO_DATE, safePath, str, UUID } from "@/lib/programming/server";

const KINDS = ["short", "long", "number", "scale", "choice", "multi", "yesno"];
const REPEATS = ["once", "weekly", "fortnightly", "monthly"];

function go(path: string, error?: string): never {
  revalidatePath(path.split(/[?#]/)[0]);
  if (!error) redirect(path);
  const [base, hash] = path.split("#");
  redirect(`${base}${base.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}${hash ? `#${hash}` : ""}`);
}
const formPath = (id: string) => `/coach/forms/${id}`;

export async function createForm(fd: FormData) {
  const supabase = await coachOnly();
  const name = str(fd.get("name"), 80);
  if (!name || name.length < 2) go("/coach/forms", "Name the form.");
  const { data, error } = await supabase.from("forms").insert({ name }).select("id").single();
  if (error) go("/coach/forms", friendly(error.message));
  go(formPath(data!.id));
}

export async function updateForm(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) go("/coach/forms");
  const name = str(fd.get("name"), 80);
  if (!name || name.length < 2) go(formPath(id), "Name the form.");
  const { error } = await supabase
    .from("forms")
    .update({ name, description: str(fd.get("description"), 1000), archived: fd.get("archived") === "on" })
    .eq("id", id);
  go(formPath(id), error ? friendly(error.message) : undefined);
}

export async function deleteForm(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  if (fd.get("confirm") !== "DELETE") go(formPath(id), "Type DELETE to confirm.");
  if (UUID.test(id)) {
    const { error } = await supabase.from("forms").delete().eq("id", id);
    if (error) go(formPath(id), friendly(error.message));
  }
  go("/coach/forms");
}

function questionRow(fd: FormData): { row?: Record<string, unknown>; error?: string } {
  const kind = String(fd.get("kind") ?? "");
  const label = str(fd.get("label"), 200);
  if (!KINDS.includes(kind)) return { error: "Pick a question type." };
  if (!label) return { error: "Write the question." };
  const options =
    kind === "choice" || kind === "multi"
      ? String(fd.get("options") ?? "")
          .split("\n")
          .map((o) => o.trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, 12)
      : [];
  if ((kind === "choice" || kind === "multi") && options.length < 2) return { error: "Add at least 2 options, one per line." };
  return { row: { kind, label, help: str(fd.get("help"), 300), options, required: fd.get("required") === "on" } };
}

export async function addQuestion(fd: FormData) {
  const supabase = await coachOnly();
  const formId = String(fd.get("form_id") ?? "");
  if (!UUID.test(formId)) go("/coach/forms");
  const q = questionRow(fd);
  if (!q.row) go(formPath(formId), q.error);
  const { data: last } = await supabase.from("form_questions").select("position").eq("form_id", formId).order("position", { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from("form_questions")
    .insert({ ...q.row, form_id: formId, position: (last?.[0]?.position ?? 0) + 1 })
    .select("id")
    .single();
  go(`${formPath(formId)}#q-${data?.id ?? ""}`, error ? friendly(error.message) : undefined);
}

export async function updateQuestion(fd: FormData) {
  const supabase = await coachOnly();
  const formId = String(fd.get("form_id") ?? "");
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(formId) || !UUID.test(id)) go("/coach/forms");
  const q = questionRow(fd);
  if (!q.row) go(`${formPath(formId)}#q-${id}`, q.error);
  const { error } = await supabase.from("form_questions").update(q.row).eq("id", id).eq("form_id", formId);
  go(`${formPath(formId)}#q-${id}`, error ? friendly(error.message) : undefined);
}

export async function deleteQuestion(fd: FormData) {
  const supabase = await coachOnly();
  const formId = String(fd.get("form_id") ?? "");
  const id = String(fd.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("form_questions").delete().eq("id", id).eq("form_id", formId);
  go(formPath(formId));
}

export async function moveQuestion(fd: FormData) {
  const supabase = await coachOnly();
  const formId = String(fd.get("form_id") ?? "");
  const id = String(fd.get("id") ?? "");
  const dir = fd.get("dir") === "up" ? -1 : 1;
  if (!UUID.test(formId) || !UUID.test(id)) go("/coach/forms");
  const { data } = await supabase.from("form_questions").select("id, position").eq("form_id", formId).order("position");
  const list = data ?? [];
  const i = list.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i >= 0 && j >= 0 && j < list.length) {
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((r, k) => supabase.from("form_questions").update({ position: k + 1 }).eq("id", r.id)));
  }
  go(`${formPath(formId)}#q-${id}`);
}

export async function assignForm(fd: FormData) {
  const supabase = await coachOnly();
  const formId = String(fd.get("form_id") ?? "");
  const back = safePath(fd.get("back"), formPath(formId));
  const repeat = String(fd.get("repeat") ?? "weekly");
  const start = String(fd.get("starts_on") ?? "");
  const ids = fd.getAll("athlete_id").map(String).filter((x) => UUID.test(x));
  if (!UUID.test(formId)) go("/coach/forms");
  if (!ids.length) go(back, "Pick at least one client.");
  if (!REPEATS.includes(repeat) || !ISO_DATE.test(start)) go(back, "Pick how often and a start date.");
  const { error } = await supabase
    .from("form_assignments")
    .upsert(ids.map((athlete_id) => ({ form_id: formId, athlete_id, repeat, starts_on: start, active: true })), { onConflict: "form_id,athlete_id" });
  go(back, error ? friendly(error.message) : undefined);
}

export async function unassignForm(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const back = safePath(fd.get("back"), "/coach/forms");
  if (UUID.test(id)) await supabase.from("form_assignments").delete().eq("id", id);
  go(back);
}

export async function markResponseSeen(fd: FormData) {
  const supabase = await coachOnly();
  const id = String(fd.get("id") ?? "");
  const back = safePath(fd.get("back"), "/coach");
  if (UUID.test(id)) await supabase.from("form_responses").update({ coach_seen_at: new Date().toISOString() }).eq("id", id);
  go(back);
}
