import Link from "next/link";
import { requireState } from "@/lib/session";
import type { Program } from "@/lib/programming/types";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { createFolder, createProgram, deleteFolder, duplicateProgram, moveProgram, renameFolder, saveAsMaster, setProgramArchived } from "./actions";
import { childrenOf, descendants, folderOptions, pathTo, type Folder } from "@/lib/programming/folders";
import { Folder as FolderIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; archived?: string; view?: string; f?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { error, archived: archivedParam, view, f } = await searchParams;
  const archived = archivedParam || view === "archived";
  const mastersView = view === "masters";
  const [{ data }, { data: counts }, { data: folderRows }] = await Promise.all([
    supabase.from("programs").select("*").order("updated_at", { ascending: false }),
    supabase.from("program_days").select("program_id"),
    supabase.from("program_folders").select("id, name, parent_id, sort_order"),
  ]);
  const folders = (folderRows ?? []) as Folder[];
  const folder = folders.find((x) => x.id === f) ?? null;
  const crumbs = pathTo(folders, folder?.id ?? null);
  const subfolders = childrenOf(folders, folder?.id ?? null);
  const options = folderOptions(folders);
  const allPrograms = (data ?? []) as (Program & { is_master: boolean; folder_id: string | null })[];
  const masters = allPrograms.filter((p) => p.is_master && !p.archived);
  const browsing = !mastersView && !archived;
  const programs = allPrograms.filter((p) =>
    mastersView ? p.is_master && !p.archived : p.archived === !!archived && (archived || !p.is_master) && (!browsing || (p.folder_id ?? null) === (folder?.id ?? null)),
  );
  const liveCount = (id: string) => {
    const ids = descendants(folders, id);
    return allPrograms.filter((p) => !p.archived && !p.is_master && p.folder_id && ids.has(p.folder_id)).length;
  };
  const days = new Map<string, number>();
  for (const d of counts ?? []) days.set(d.program_id, (days.get(d.program_id) ?? 0) + 1);

  return (
    <Screen wide>
      <BackLink href={crumbs.length > 1 ? `/coach/programs?f=${crumbs[crumbs.length - 2].id}` : folder ? "/coach/programs" : "/coach"} label={crumbs.length > 1 ? crumbs[crumbs.length - 2].name : folder ? "All folders" : "Dashboard"} />
      <Heading sub="Build once, assign to a client or group in three taps.">
        Programs
      </Heading>
      {error && <Alert>{error}</Alert>}

      <Card className="mb-6 !p-4">
        <h2 className="mb-3 font-extrabold">New program</h2>
        <h2 className="sr-only">New program{folder ? ` in ${folder.name}` : ""}</h2>
        {folder && <p className="-mt-2 mb-2 text-sm text-muted">Goes in <b className="text-text">{crumbs.map((c) => c.name).join(" › ")}</b></p>}
        <form action={createProgram} className="grid gap-2 sm:grid-cols-[1fr_7rem_10rem_auto]">
          {folder && <input type="hidden" name="folder_id" value={folder.id} />}
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

      {browsing && (
        <>
          <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm" aria-label="Folders">
            <Link href="/coach/programs" className={folder ? "text-muted hover:text-text" : "font-bold"}>All folders</Link>
            {crumbs.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1">
                <span className="text-muted">›</span>
                {i === crumbs.length - 1 ? <b>{c.name}</b> : <Link href={`/coach/programs?f=${c.id}`} className="text-muted hover:text-text">{c.name}</Link>}
              </span>
            ))}
          </nav>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {subfolders.map((sf) => (
              <div key={sf.id} className="rounded-xl border border-line bg-surface">
                <Link href={`/coach/programs?f=${sf.id}`} className="flex min-h-14 items-center gap-3 px-3">
                  <FolderIcon size={20} className="shrink-0 text-brand" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{sf.name}</span>
                    <span className="block text-xs text-muted">
                      {liveCount(sf.id)} program{liveCount(sf.id) === 1 ? "" : "s"}
                      {childrenOf(folders, sf.id).length ? ` · ${childrenOf(folders, sf.id).length} folder${childrenOf(folders, sf.id).length === 1 ? "" : "s"}` : ""}
                    </span>
                  </span>
                </Link>
                <details className="border-t border-line px-3 py-1 text-xs">
                  <summary className="cursor-pointer text-muted">Rename or delete</summary>
                  <form action={renameFolder} className="mt-1 flex gap-1">
                    <input type="hidden" name="id" value={sf.id} />
                    {folder && <input type="hidden" name="folder_id" value={folder.id} />}
                    <input name="name" defaultValue={sf.name} maxLength={60} required className={input} aria-label="Folder name" />
                    <button className={smallBtn}>Save</button>
                  </form>
                  <form action={deleteFolder} className="my-1">
                    <input type="hidden" name="id" value={sf.id} />
                    {folder && <input type="hidden" name="folder_id" value={folder.id} />}
                    <button className="min-h-9 text-brand underline underline-offset-4">Delete folder (programs inside move to the top level)</button>
                  </form>
                </details>
              </div>
            ))}
            {crumbs.length < 4 && (
              <form action={createFolder} className="flex min-h-14 items-center gap-2 rounded-xl border border-dashed border-line px-2">
                {folder && <input type="hidden" name="folder_id" value={folder.id} />}
                <input name="name" placeholder={folder ? `New folder in ${folder.name}` : "New folder"} maxLength={60} required className={`${input} !border-0 !bg-transparent`} aria-label="New folder name" />
                <button className={smallBtn}>Add</button>
              </form>
            )}
          </div>
        </>
      )}

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
              <form action={moveProgram} className="mt-2 flex gap-2">
                <input type="hidden" name="id" value={p.id} />
                {folder && <input type="hidden" name="folder_id" value={folder.id} />}
                <select name="to" defaultValue={p.folder_id ?? ""} className={input} aria-label="Move to folder">
                  <option value="">Top level (no folder)</option>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <button className={smallBtn}>Move</button>
              </form>
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
                : folder
                  ? "No programs in this folder yet. Create one above, or move one here from its \"More\" menu."
                  : "No programs at the top level. Open a folder, or create one above."}
          </p>
        )}
      </div>
    </Screen>
  );
}
