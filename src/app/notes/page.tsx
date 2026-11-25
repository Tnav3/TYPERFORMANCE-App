import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { requireState } from "@/lib/session";
import { BackLink, Card, Heading, Screen } from "@/components/ui";
import { addNote, deleteNote } from "./actions";

export const dynamic = "force-dynamic";
const input = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { supabase, user } = await requireState(["athlete"]);
  const { edit } = await searchParams;
  const { data } = await supabase
    .from("client_notes")
    .select("id, title, body, exercise_id, updated_at, exercises(name)")
    .eq("athlete_id", user!.id)
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as unknown as { id: string; title: string | null; body: string; exercise_id: string | null; exercises: { name: string } | null }[];
  const general = rows.filter((r) => !r.exercise_id);
  const setups = rows.filter((r) => r.exercise_id).sort((a, b) => (a.exercises?.name ?? "").localeCompare(b.exercises?.name ?? ""));
  const editing = general.find((r) => r.id === edit);
  return (
    <Screen>
      <BackLink href="/more" label="More" />
      <Heading sub="Rack heights, machine settings, anything you want to remember. Your coach can see these too.">My notes</Heading>
      <Card className="mb-4">
        <form action={addNote} className="space-y-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input name="title" defaultValue={editing?.title ?? ""} maxLength={80} placeholder="Title (optional), e.g. Gym setup" className={input} />
          <textarea name="body" defaultValue={editing?.body ?? ""} required rows={3} maxLength={1000} placeholder="e.g. Squat rack hole 7, bench hole 4. Keiser leg press seat 5." className={`${input} py-2`} />
          <div className="flex gap-2">
            <button className="min-h-11 flex-1 rounded-xl bg-brand font-bold text-white">{editing ? "Save note" : "Add note"}</button>
            {editing && <Link href="/notes" className="flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-bold">Cancel</Link>}
          </div>
        </form>
      </Card>
      {general.map((n) => (
        <Card key={n.id} className="mb-2 !p-3">
          {n.title && <p className="font-bold">{n.title}</p>}
          <p className="whitespace-pre-line text-sm">{n.body}</p>
          <div className="mt-2 flex gap-4 text-xs">
            <Link href={`/notes?edit=${n.id}`} className="text-muted underline">Edit</Link>
            <form action={deleteNote}><input type="hidden" name="id" value={n.id} /><button className="text-brand">Delete</button></form>
          </div>
        </Card>
      ))}
      <h2 className="mb-2 mt-6 text-xs font-black uppercase tracking-widest text-muted">Exercise setups</h2>
      {setups.length === 0 ? (
        <p className="text-sm text-muted">
          In a workout, tap <NotebookPen size={13} className="inline" /> <b>Add my setup note</b> under any exercise and it shows up there every time.
        </p>
      ) : (
        <div className="space-y-2">
          {setups.map((n) => (
            <div key={n.id} className="rounded-xl border border-line bg-surface p-3">
              <p className="text-sm font-bold">{n.exercises?.name}</p>
              <p className="whitespace-pre-line text-sm text-muted">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
