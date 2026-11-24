import Link from "next/link";
import { requireState } from "@/lib/session";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { createSequence } from "./actions";

export const dynamic = "force-dynamic";

const input = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export default async function SequencesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const { error } = await searchParams;
  const { data } = await supabase
    .from("sequences")
    .select("id, name, trigger, active, sequence_steps(id), sequence_enrollments(athlete_id, stopped_at)")
    .order("created_at");
  const rows = (data ?? []) as unknown as {
    id: string; name: string; trigger: string; active: boolean;
    sequence_steps: { id: string }[]; sequence_enrollments: { athlete_id: string; stopped_at: string | null }[];
  }[];
  return (
    <Screen wide>
      <BackLink href="/coach/messages" label="Scheduled messages" />
      <Heading sub="Timed in-app messages that start automatically when you approve a client (or when you add them by hand).">
        Onboarding sequences
      </Heading>
      {error && <Alert>{error}</Alert>}
      <Card className="mb-6 !p-4">
        <form action={createSequence} className="space-y-2">
          <input name="name" required maxLength={80} placeholder="e.g. New client welcome" className={input} aria-label="Name" />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <select name="trigger" defaultValue="approved" className={`${input} !w-auto`} aria-label="Starts">
              <option value="approved">Starts when I approve a client</option>
              <option value="manual">Only when I add a client</option>
            </select>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="starter" defaultChecked className="h-5 w-5 accent-[var(--color-brand)]" />
              Start with a 4-message welcome I can edit
            </label>
          </div>
          <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Create</button>
        </form>
      </Card>
      <div className="space-y-2">
        {rows.map((r) => (
          <Link key={r.id} href={`/coach/sequences/${r.id}`} className="block">
            <Card className={`!p-3 ${r.active ? "" : "opacity-60"}`}>
              <p className="font-bold">{r.name}</p>
              <p className="text-sm text-muted">
                {r.sequence_steps.length} messages · {r.trigger === "approved" ? "auto on approval" : "manual"} ·{" "}
                {r.sequence_enrollments.filter((e) => !e.stopped_at).length} enrolled{r.active ? "" : " · paused"}
              </p>
            </Card>
          </Link>
        ))}
        {!rows.length && <p className="text-muted">No sequences yet.</p>}
      </div>
    </Screen>
  );
}
