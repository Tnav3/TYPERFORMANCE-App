import { createClient } from "@/lib/supabase/server";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";
import { LinkedText } from "@/components/LinkedText";
import { addTemplate, deleteTemplate, updateTemplate } from "./actions";

export const dynamic = "force-dynamic";
const input = "min-h-10 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-text";

export default async function HabitLibrary({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("habit_templates").select("id, name, details").order("sort_order").order("name");
  return (
    <Screen>
      <BackLink href="/coach/library" label="Exercise library" />
      <Heading sub="Ready-made habits with instructions. Add one to a client from their Lifestyle page in one tap.">Habit library</Heading>
      {error && <Alert>{error}</Alert>}
      <details className="mb-5 rounded-2xl border border-brand/50 bg-surface p-4">
        <summary className="cursor-pointer list-none font-extrabold">+ New habit</summary>
        <form action={addTemplate} className="mt-3 space-y-2">
          <input name="name" required maxLength={80} placeholder="e.g. 3 L water a day" className={input} aria-label="Habit name" />
          <textarea name="details" maxLength={2000} rows={4} placeholder="Instructions the client sees (links are fine)" className={input} aria-label="Instructions" />
          <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Add</button>
        </form>
      </details>
      <div className="space-y-2">
        {(data ?? []).map((h) => (
          <details key={h.id} className="rounded-2xl border border-line bg-surface p-4">
            <summary className="cursor-pointer list-none">
              <span className="font-extrabold">{h.name}</span>
              {h.details && <span className="mt-0.5 block text-xs text-muted line-clamp-2"><LinkedText text={h.details} /></span>}
            </summary>
            <form action={updateTemplate} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={h.id} />
              <input name="name" defaultValue={h.name} required maxLength={80} className={input} aria-label="Habit name" />
              <textarea name="details" defaultValue={h.details ?? ""} maxLength={2000} rows={6} className={input} aria-label="Instructions" />
              <button className="min-h-10 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Save</button>
            </form>
            <form action={deleteTemplate} className="mt-2">
              <input type="hidden" name="id" value={h.id} />
              <button className="text-xs font-bold text-muted underline underline-offset-4">Delete from library</button>
            </form>
          </details>
        ))}
      </div>
    </Screen>
  );
}
