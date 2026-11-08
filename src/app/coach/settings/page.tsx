import Link from "next/link";
import { requireState } from "@/lib/session";
import { getCatalog } from "@/lib/catalog";
import { disciplineColors } from "@/lib/colors";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import {
  addDiscipline,
  addType,
  move,
  renameDiscipline,
  renameType,
  setDisciplineActive,
  setTypeActive,
} from "./actions";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

// Mobile: name gets the full width on its own line; move/hide sit underneath.
// Wider screens: everything on one line.
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { error } = await searchParams;
  const catalog = await getCatalog(supabase);
  const colors = disciplineColors(catalog);

  return (
    <Screen wide>
      <BackLink href="/coach" label="Dashboard" />
      <Heading sub="Hidden items disappear from athletes' pickers but stay on old sessions, so history is never lost.">
        Disciplines & session types
      </Heading>
      {error && <Alert>{error}</Alert>}

      <Link
        href="/coach/settings/tests"
        className="mb-6 flex min-h-12 items-center justify-between rounded-xl border border-line bg-surface-2 px-4 font-extrabold"
      >
        Field test videos & instructions <span aria-hidden>→</span>
      </Link>
      <Link
        href="/coach/settings/lifts"
        className="-mt-4 mb-6 flex min-h-12 items-center justify-between rounded-xl border border-line bg-surface-2 px-4 font-extrabold"
      >
        Calculator lifts <span aria-hidden>→</span>
      </Link>

      <div className="space-y-4">
        {catalog.map((d, di) => (
          <Card key={d.id} className={`!p-4 ${d.active ? "" : "opacity-60"}`}>
            <Row
              name={
                <form
                  action={renameDiscipline}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ background: colors[d.id] }}
                    aria-hidden
                  />
                  <input type="hidden" name="id" value={d.id} />
                  <input
                    name="name"
                    defaultValue={d.name}
                    maxLength={60}
                    className={`${input} font-extrabold`}
                    aria-label="Discipline name"
                  />
                  <button className={smallBtn}>Save</button>
                </form>
              }
              controls={
                <>
                  <MoveButtons
                    table="disciplines"
                    id={d.id}
                    first={di === 0}
                    last={di === catalog.length - 1}
                  />
                  <ToggleForm
                    action={setDisciplineActive}
                    id={d.id}
                    active={d.active}
                  />
                </>
              }
            />
            {!d.active && (
              <p className="mt-2 text-xs text-warn">Hidden from athletes</p>
            )}
            {d.active && !d.types.some((t) => t.active) && (
              <p className="mt-2 text-xs text-warn">
                Add a session type — athletes won&apos;t see this discipline
                until it has one.
              </p>
            )}

            <ul className="mt-3 space-y-2">
              {d.types.map((t, ti) => (
                <li
                  key={t.id}
                  className={`rounded-xl border border-line p-2 ${t.active ? "" : "opacity-60"}`}
                >
                  <Row
                    name={
                      <form
                        action={renameType}
                        className="flex min-w-0 flex-1 gap-2"
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <input
                          name="name"
                          defaultValue={t.name}
                          maxLength={60}
                          className={input}
                          aria-label={`${d.name} session type`}
                        />
                        <button className={smallBtn}>Save</button>
                      </form>
                    }
                    controls={
                      <>
                        <MoveButtons
                          table="session_types"
                          id={t.id}
                          first={ti === 0}
                          last={ti === d.types.length - 1}
                        />
                        <ToggleForm
                          action={setTypeActive}
                          id={t.id}
                          active={t.active}
                        />
                      </>
                    }
                  />
                </li>
              ))}
            </ul>

            <form action={addType} className="mt-3 flex gap-2">
              <input type="hidden" name="discipline_id" value={d.id} />
              <input
                name="name"
                placeholder={`Add a ${d.name} session type`}
                maxLength={60}
                className={input}
                required
              />
              <button className="min-h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">
                Add
              </button>
            </form>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
          New discipline
        </h2>
        <form action={addDiscipline} className="flex gap-2">
          <input
            name="name"
            placeholder="e.g. Judo"
            maxLength={60}
            className={input}
            required
          />
          <button className="min-h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">
            Add
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Then add its session types (e.g. Randori, Drilling).
        </p>
      </Card>
    </Screen>
  );
}

function Row({
  name,
  controls,
}: {
  name: React.ReactNode;
  controls: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {name}
      <div className="flex justify-end gap-1">{controls}</div>
    </div>
  );
}

function ToggleForm({
  action,
  id,
  active,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  active: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <button className={`${smallBtn} w-16`}>{active ? "Hide" : "Show"}</button>
    </form>
  );
}

function MoveButtons({
  table,
  id,
  first,
  last,
}: {
  table: string;
  id: string;
  first: boolean;
  last: boolean;
}) {
  return (
    <div className="flex gap-1">
      {(["up", "down"] as const).map((dir) => (
        <form key={dir} action={move}>
          <input type="hidden" name="table" value={table} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="dir" value={dir} />
          <button
            disabled={dir === "up" ? first : last}
            aria-label={`Move ${dir}`}
            className="grid min-h-11 w-11 place-items-center rounded-xl border border-line bg-surface-2 text-lg disabled:opacity-25"
          >
            {dir === "up" ? "↑" : "↓"}
          </button>
        </form>
      ))}
    </div>
  );
}
