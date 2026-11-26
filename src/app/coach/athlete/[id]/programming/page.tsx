import { ClientContext } from "@/components/ClientContext";
import { folderOptions, type Folder } from "@/lib/programming/folders";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { addDays } from "@/lib/week";
import { allExercises } from "@/lib/programming/all-exercises";
import { ClientTabs } from "@/components/ClientTabs";
import { SeasonList } from "@/components/SeasonList";
import { Alert, Screen } from "@/components/ui";
import { BlockOverview } from "@/components/BlockOverview";
import { createClientBlock, importBlock } from "../program/actions";

export const dynamic = "force-dynamic";


// Planning side of a client: what to keep in mind, training plan, build/import blocks, manage blocks.
// The Calendar tab stays a clean month view.
export default async function ClientProgrammingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; removed?: string; swapped?: string; shifted?: string; block?: string; length?: string; kept?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const sp = await searchParams;
  const today = todayISO();
  const [{ data: client }, { data: assignments }, { data: groups }, { data: folderRows }, { data: otherBlocks }, exAll, { data: progs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("id", id).maybeSingle(),
    supabase.from("assignments").select("id, program_name, start_date, reveal_weeks, reveal_weekly").eq("athlete_id", id).order("start_date", { ascending: false }),
    supabase.from("group_members").select("groups(id, name)").eq("athlete_id", id),
    supabase.from("program_folders").select("id, name, parent_id, sort_order"),
    supabase
      .from("assignments")
      .select("id, program_name, start_date, athlete_id, profiles(full_name, email)")
      .not("athlete_id", "is", null)
      .neq("athlete_id", id)
      .gte("start_date", addDays(today, -365))
      .order("start_date", { ascending: false })
      .limit(200),
    allExercises(supabase),
    supabase.from("programs").select("id, name, weeks, is_master, folder_id").eq("archived", false).order("is_master", { ascending: false }).order("name"),
  ]);
  if (!client) notFound();
  const exList = exAll.filter((e) => e.active);
  const blockInput = "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
  const folderLabel = new Map(folderOptions((folderRows ?? []) as Folder[]).map((o) => [o.id, o.label]));
  const blocksByClient = new Map<string, { id: string; program_name: string; start_date: string }[]>();
  for (const b of (otherBlocks ?? []) as unknown as { id: string; program_name: string; start_date: string; profiles: { full_name: string | null; email: string } | null }[]) {
    const who = b.profiles?.full_name ?? b.profiles?.email ?? "Client";
    blocksByClient.set(who, [...(blocksByClient.get(who) ?? []), b]);
  }
  const nextMonday = addDays(today, ((8 - new Date(today + "T00:00:00Z").getUTCDay()) % 7) || 7);
  const name = client.full_name ?? client.email;
  const back = `/coach/athlete/${id}/programming`;
  const progByFolder = new Map<string, { id: string; name: string; weeks: number }[]>();
  for (const p of progs ?? []) {
    const f = p.folder_id ? folderLabel.get(p.folder_id) ?? "Programs" : "Not in a folder";
    progByFolder.set(f, [...(progByFolder.get(f) ?? []), p]);
  }
  return (
    <Screen wide>
      <ClientTabs id={id} name={name} active="programming" />
      <ClientContext athleteId={id} />
      {sp.error && <Alert>{sp.error}</Alert>}
      {sp.swapped && <Alert tone="ok">Swapped on {sp.swapped} upcoming line{sp.swapped === "1" ? "" : "s"}.</Alert>}
      {sp.shifted && <Alert tone="ok">Moved {sp.shifted} upcoming workout{sp.shifted === "1" ? "" : "s"}. Logged ones stayed put.</Alert>}
      {sp.length && (
        <Alert tone="ok">
          Block is now {sp.length} week{sp.length === "1" ? "" : "s"}.
          {sp.kept ? ` ${sp.kept} logged or past session${sp.kept === "1" ? "" : "s"} after the new end stayed put.` : ""}
        </Alert>
      )}
      {sp.removed && <Alert tone="ok">Removed {sp.removed} upcoming workouts. Past and logged ones are kept.</Alert>}

      <div className="mb-3">
        <SeasonList supabase={supabase} target={{ athlete_id: id }} back={back} today={today} />
      </div>
      <div id="blocks" className="mb-2 grid gap-2 lg:grid-cols-2">
        <details className="group rounded-2xl border border-line bg-surface open:p-4 [&:not([open])]:p-0">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 font-extrabold group-open:mb-2 group-open:px-0 [&::-webkit-details-marker]:hidden">
            <span>+ Build a new block for {client.full_name?.split(" ")[0] ?? "this client"}</span>
            <span className="text-muted transition group-open:rotate-180" aria-hidden>▾</span>
          </summary>
          <p className="mb-3 text-sm text-muted">Goes straight onto their calendar. Then tap each day to add exercises, and use &quot;copy week forward&quot; to repeat it.</p>
          <form action={createClientBlock} className="space-y-3">
            <input type="hidden" name="athlete_id" value={id} />
            <input name="name" required minLength={2} maxLength={60} placeholder="Block name, e.g. Strength Block 1" className={blockInput} aria-label="Block name" />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">Starts<input type="date" name="start" required defaultValue={nextMonday} className={blockInput} /></label>
              <label className="text-xs text-muted">Weeks<input type="number" name="weeks" min={1} max={16} defaultValue={4} className={blockInput} /></label>
            </div>
            <fieldset>
              <legend className="mb-1 text-xs text-muted">Training days</legend>
              <div className="flex flex-wrap gap-1.5">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                  <label key={d} className="cursor-pointer">
                    <input type="checkbox" name="days" value={i + 1} defaultChecked={[0, 2, 4].includes(i)} className="peer sr-only" />
                    <span className="inline-flex min-h-10 min-w-12 items-center justify-center rounded-xl border border-line text-sm font-bold text-muted peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white">{d}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="min-h-11 w-full rounded-xl bg-brand font-extrabold uppercase text-white">Create block</button>
          </form>
        </details>
        <details className="group rounded-2xl border border-line bg-surface open:p-4 [&:not([open])]:p-0">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 font-extrabold group-open:mb-2 group-open:px-0 [&::-webkit-details-marker]:hidden">
            <span>Import a program</span>
            <span className="text-muted transition group-open:rotate-180" aria-hidden>▾</span>
          </summary>
          <p className="mb-3 text-sm text-muted">Copy a program from your folders, or a block another client is doing. It&apos;s theirs to edit after that; the original doesn&apos;t change.</p>
          <form action={importBlock} className="space-y-3">
            <input type="hidden" name="athlete_id" value={id} />
            <select name="source" required defaultValue="" className={blockInput} aria-label="What to import">
              <option value="" disabled>Choose…</option>
              {[...progByFolder.entries()].map(([folder, list]) => (
                <optgroup key={folder} label={`📁 ${folder}`}>
                  {list.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name} · {p.weeks} wk</option>)}
                </optgroup>
              ))}
              {[...blocksByClient.entries()].map(([who, list]) => (
                <optgroup key={who} label={`👤 ${who}`}>
                  {list.map((b) => <option key={b.id} value={`a:${b.id}`}>{b.program_name} · from {b.start_date}</option>)}
                </optgroup>
              ))}
            </select>
            <label className="block text-xs text-muted">Start on<input type="date" name="start" required defaultValue={nextMonday} className={blockInput} /></label>
            <button className="min-h-11 w-full rounded-xl border border-line bg-surface-2 font-extrabold uppercase">Import</button>
          </form>
        </details>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
        <div className="text-muted">
          {(groups ?? []).length > 0 && (
            <p className="text-sm text-muted">
              Also gets workouts from:{" "}
              {(groups ?? []).map((g, i) => {
                const grp = g.groups as unknown as { id: string; name: string };
                return (
                  <span key={grp.id}>
                    {i > 0 && ", "}
                    <Link href={`/coach/groups/${grp.id}`} className="underline underline-offset-4">
                      {grp.name}
                    </Link>
                  </span>
                );
              })}
            </p>
          )}
        </div>
        <Link href="/coach/programs" className="font-bold text-brand">Build or edit programs →</Link>
      </div>

      <BlockOverview supabase={supabase} athleteId={id} assignments={(assignments ?? []) as { id: string; program_name: string; start_date: string; reveal_weeks?: number | null; reveal_weekly?: boolean | null }[]} selected={sp.block} today={today} back={back} />

      <datalist id="swap-ex">
        {exList.map((e) => <option key={e.id} value={e.name} />)}
      </datalist>
    </Screen>
  );
}
