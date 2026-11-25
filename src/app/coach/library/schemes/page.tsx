import Link from "next/link";
import { requireState } from "@/lib/session";
import { Alert, Card, Heading, Screen } from "@/components/ui";
import { schemeText } from "@/lib/programming/schemes";
import { formatSetPlan } from "@/lib/prescription";
import type { SetTarget } from "@/lib/programming/types";
import { deleteScheme, saveScheme } from "./actions";

export const dynamic = "force-dynamic";
const input = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

type Row = { id: string; name: string; description: string | null; weeks: SetTarget[][] };

function SchemeForm({ s }: { s?: Row }) {
  return (
    <form action={saveScheme} className="space-y-2">
      {s && <input type="hidden" name="id" value={s.id} />}
      <input name="name" defaultValue={s?.name} required maxLength={60} placeholder="Name, e.g. Wave 3/2/1" className={input} />
      <input name="description" defaultValue={s?.description ?? ""} maxLength={300} placeholder="When to use it (optional)" className={input} />
      <textarea
        name="weeks"
        rows={5}
        defaultValue={s ? schemeText(s.weeks) : ""}
        placeholder={"One week per line:\n5@75%, 5@75%, 5@75%\n5@77.5%, 4@80%, 4@80%\n5@80%, 4@82.5%, 3@85%"}
        className={`${input} py-2 font-mono text-sm`}
      />
      <p className="text-xs text-muted">
        <b>75%</b> = % of 1RM · <b>@8</b> = RPE 8 · <b>40kg</b> = fixed load · <b>5+</b> = AMRAP set · no @ = reps only. Shorter than the block? It repeats.
      </p>
      <button className="min-h-11 w-full rounded-xl bg-brand font-bold text-white">{s ? "Save scheme" : "Add scheme"}</button>
    </form>
  );
}

export default async function SchemesPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string; error?: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const sp = await searchParams;
  const { data } = await supabase.from("loading_schemes").select("id, name, description, weeks").order("sort").order("name");
  const rows = (data ?? []) as Row[];
  const editing = rows.find((r) => r.id === sp.edit);
  return (
    <Screen>
      <Link href="/coach/library" className="mb-2 inline-block text-sm text-muted">← Exercise library</Link>
      <Heading sub="Pick one on any exercise and it fills the sets, reps and intensity for every week of the block. You can still type sets and reps by hand.">Loading schemes</Heading>
      {sp.error && <Alert>{sp.error}</Alert>}
      {editing ? (
        <Card className="mb-4">
          <div className="mb-2 flex justify-between"><h2 className="font-bold">Edit scheme</h2><Link href="/coach/library/schemes" className="text-sm text-muted">Cancel</Link></div>
          <SchemeForm s={editing} />
          <form action={deleteScheme} className="mt-2"><input type="hidden" name="id" value={editing.id} /><button className="text-sm text-red-400">Delete scheme</button></form>
        </Card>
      ) : (
        <details className="mb-4" open={!!sp.new}>
          <summary className="min-h-11 cursor-pointer rounded-xl border border-line bg-surface px-4 py-3 font-bold">+ New scheme</summary>
          <Card className="mt-2"><SchemeForm /></Card>
        </details>
      )}
      <div className="space-y-2">
        {rows.map((r) => (
          <Link key={r.id} href={`/coach/library/schemes?edit=${r.id}`} className="block rounded-xl border border-line bg-surface p-3">
            <div className="font-semibold">{r.name}</div>
            {r.description && <div className="text-xs text-muted">{r.description}</div>}
            <ol className="mt-1 space-y-0.5 text-xs">
              {r.weeks.map((w, i) => <li key={i}><span className="text-muted">Wk {i + 1}</span> {formatSetPlan(w)}</li>)}
            </ol>
          </Link>
        ))}
      </div>
    </Screen>
  );
}
