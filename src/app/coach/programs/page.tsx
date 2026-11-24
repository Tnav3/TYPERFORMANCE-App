import Link from "next/link";
import { requireState } from "@/lib/session";
import type { Program } from "@/lib/programming/types";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { createProgram, duplicateProgram, saveAsMaster, setProgramArchived } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; archived?: string; view?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { error, archived: archivedParam, view } = await searchParams;
  const archived = archivedParam || view === "archived";
  const mastersView = view === "masters";
  const [{ data }, { data: counts }] = await Promise.all([
    supabase.from("programs").select("*").order("updated_at", { ascending: false }),
    supabase.from("program_days").select("program_id"),
  ]);
  const allPrograms = (data ?? []) as (Program & { is_master: boolean })[];
  const masters = allPrograms.filter((p) => p.is_master && !p.archived);
  const programs = allPrograms.filter((p) =>
    mastersView ? p.is_master && !p.archived : p.archived === !!archived && (archived || !p.is_master),
  );
  const days = new Map<string, number>();
  for (const d of counts ?? []) days.set(d.program_id, (days.get(d.program_id) ?? 0) + 1);

  return (
    <Screen wide>
      <BackLink href="/coach" label="Dashboard" />
      <Heading sub="Build once, assign to a client or group in three taps.">
        Programs
      </Heading>
      {error && <Alert>{error}</Alert>}

      <Card className="mb-6 !p-4">
        <h2 className="mb-3 font-extrabold">New program</h2>
        <form action={createProgram} className="grid gap-2 sm:grid-cols-[1fr_7rem_10rem_auto]">
          <input name="name" placeholder="e.g. Fight camp: 8 weeks out" required maxLength={80} className={input} aria-label="Program name" />
          <input name="weeks" type="number" min={1} max={52} defaultValue={4} className={input} aria-label="Weeks" />
          <input name="tag" placeholder="Tag (optional)" maxLength={40} className={input} aria-label="Tag" />
          {masters.length > 0 && (
            <select name="from_master" defaultValue="" className={`${input} sm:col-span-4`} aria-label="Start from a master template">
              <option value="">Start blank</option>
              {masters.map((m) => (
                <option key={m.id} value={m.id}>
                  Start from master: {m.name}
                </option>
              ))}
            </select>
          )}
          <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">
            Create
          </button>
        </form>
      </Card>

      <div className="mb-3 flex gap-4 text-sm">
        <Link href="/coach/programs" className={archived || mastersView ? "text-muted" : "font-bold text-text"}>Programs</Link>
        <Link href="/coach/programs?view=masters" className={mastersView ? "font-bold text-text" : "text-muted"}>Master templates ({masters.length})</Link>
        <Link href="/coach/programs?view=archived" className={archived ? "font-bold text-text" : "text-muted"}>Archived</Link>
      </div>

      <div className="space-y-2">
        {programs.map((p) => (
          <Card key={p.id} className="!p-3">
            <Link href={`/coach/programs/${p.id}`} className="block">
              <p className="font-bold">
                {p.name}
                {p.is_master && <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand">Master</span>}
              </p>
              <p className="text-sm text-muted">
                {p.weeks} {p.weeks === 1 ? "week" : "weeks"} · {days.get(p.id) ?? 0} training days
                {p.tag && ` · ${p.tag}`}
              </p>
            </Link>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-muted">More</summary>
              <form action={duplicateProgram} className="mt-2 flex gap-2">
                <input type="hidden" name="id" value={p.id} />
                <input name="name" defaultValue={`${p.name} (copy)`} maxLength={80} className={input} aria-label="Name for the copy" />
                <button className={smallBtn}>Duplicate</button>
              </form>
              {!p.is_master && (
                <form action={saveAsMaster} className="mt-2 flex gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <input name="name" defaultValue={`${p.name} (master)`} maxLength={80} className={input} aria-label="Master template name" />
                  <button className={smallBtn}>Save as master</button>
                </form>
              )}
              <form action={setProgramArchived} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="archived" value={String(!p.archived)} />
                <button className="text-sm text-muted underline underline-offset-4">
                  {p.archived ? "Restore" : "Archive"}
                </button>
              </form>
            </details>
          </Card>
        ))}
        {programs.length === 0 && (
          <p className="text-muted">
            {mastersView
              ? "No master templates yet. Open a program's \"More\" and tap Save as master."
              : archived
                ? "No archived programs."
                : "No programs yet. Create your first one above."}
          </p>
        )}
      </div>
    </Screen>
  );
}
