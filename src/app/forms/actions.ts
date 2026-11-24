"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signedIn, UUID } from "@/lib/programming/server";
import { todayISO } from "@/lib/dates";
import { currentDue, readAnswers, type FormQuestion, type Repeat } from "@/lib/forms";

export async function submitForm(fd: FormData) {
  const { supabase, user } = await signedIn();
  const id = String(fd.get("assignment_id") ?? "");
  if (!UUID.test(id)) redirect("/forms");
  const back = `/forms/${id}`;
  const { data: a } = await supabase.from("form_assignments").select("form_id, repeat, starts_on, active").eq("id", id).eq("athlete_id", user.id).maybeSingle();
  if (!a || !a.active) redirect("/forms");
  const due = currentDue({ repeat: a.repeat as Repeat, starts_on: a.starts_on }, todayISO());
  if (!due) redirect(`${back}?error=${encodeURIComponent("This form isn't due yet.")}`);
  const { data: qs } = await supabase.from("form_questions").select("*").eq("form_id", a.form_id).order("position");
  const r = readAnswers((qs ?? []) as FormQuestion[], (k) => (fd.get(k) == null ? null : String(fd.get(k))), (k) => fd.getAll(k).map(String));
  if (r.error) redirect(`${back}?error=${encodeURIComponent(r.error)}`);
  const { error } = await supabase.from("form_responses").insert({ form_id: a.form_id, athlete_id: user.id, due_on: due, answers: r.answers });
  if (error) {
    const msg = /duplicate/.test(error.message) ? "You've already sent this one. Thanks!" : "Couldn't send. Check your connection and try again.";
    redirect(`${back}?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/forms");
  revalidatePath("/athlete");
  redirect("/forms?sent=1");
}
