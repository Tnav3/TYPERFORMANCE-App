import { requireState } from "@/lib/session";
import { getLifts } from "@/lib/lift-data";
import { groupLifts } from "@/lib/calculator";
import {
  addLift,
  renameLift,
  setLiftActive,
  setLiftParent,
} from "@/app/calculator/actions";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn =
  "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

export const dynamic = "force-dynamic";

export default async function LiftSettings({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { error } = await searchParams;
  const lifts = await getLifts(supabase);
  const parents = lifts.filter((l) => l.kind !== "jump");
  const groups = groupLifts(lifts);

  return (
    <Screen wide>
      <BackLink href="/coach/settings" label="Settings" />
      <Heading sub="Hidden lifts disappear from the calculator but keep any saved e1RMs.">
        Calculator lifts
      </Heading>
      {error && <Alert>{error}</Alert>}

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.category}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
              {g.label}
            </h2>
            <div className="space-y-2">
              {g.lifts.map((l) => (
                <Card
                  key={l.key}
                  className={`!p-3 scroll-mt-6 ${l.active ? "" : "opacity-60"}`}
                >
                  <div id={l.key} className="flex items-center gap-2">
                    <form
                      action={renameLift}
                      className="flex min-w-0 flex-1 gap-2"
                    >
                      <input type="hidden" name="key" value={l.key} />
                      <input
                        name="name"
                        defaultValue={l.name}
                        maxLength={60}
                        className={input}
                        aria-label="Lift name"
                      />
                      <button className={smallBtn}>Rename</button>
                    </form>
                    <form action={setLiftActive}>
                      <input type="hidden" name="key" value={l.key} />
                      <input
                        type="hidden"
                        name="active"
                        value={String(!l.active)}
                      />
                      <button className={smallBtn}>
                        {l.active ? "Hide" : "Show"}
                      </button>
                    </form>
                  </div>
                  {(l.kind === "bodyweight" ||
                    l.kind === "olympic" ||
                    l.per_leg ||
                    l.velocity_model ||
                    l.bar_weight_input) && (
                    <p className="mt-2 text-xs text-muted">
                      {l.kind === "bodyweight" && "Bodyweight + added load. "}
                      {l.kind === "olympic" && "1–3 rep max only. "}
                      {l.per_leg && "Per leg. "}
                      {l.velocity_model && "Has a research bar-speed guide. "}
                      {l.bar_weight_input &&
                        "Athlete enters their bar weight. "}
                    </p>
                  )}
                  {l.kind === "jump" && (
                    <form action={setLiftParent} className="mt-2 flex gap-2">
                      <input type="hidden" name="key" value={l.key} />
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                        <span className="shrink-0 text-muted">% of</span>
                        <select
                          name="parent_key"
                          defaultValue={l.parent_key ?? ""}
                          className={input}
                        >
                          {parents.map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className={smallBtn}>Save</button>
                    </form>
                  )}
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Card className="mt-8 !p-4">
        <h2 className="mb-3 font-extrabold">Add a lift</h2>
        <form action={addLift} className="space-y-3">
          <input
            name="name"
            placeholder="e.g. Paused back squat"
            maxLength={60}
            className={input}
            aria-label="New lift name"
          />
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Type</span>
            <select name="kind" defaultValue="barbell" className={input}>
              <option value="barbell">Normal lift (weight × reps)</option>
              <option value="bodyweight">
                Bodyweight + added load (like weighted chin-up)
              </option>
              <option value="olympic">Olympic lift (1–3 rep max)</option>
              <option value="jump">
                Loaded jump / throw (% of another lift)
              </option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">
              Group (normal and bodyweight lifts)
            </span>
            <select name="category" defaultValue="squat" className={input}>
              <option value="squat">Squat / lower</option>
              <option value="hinge">Hinge</option>
              <option value="press">Press</option>
              <option value="pull">Pull</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">
              Based on (loaded jumps / throws only)
            </span>
            <select name="parent_key" defaultValue="" className={input}>
              <option value="">—</option>
              {parents.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="per_leg"
              className="h-5 w-5 accent-[var(--color-brand)]"
            />
            Per leg
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="bar_weight_input"
              className="h-5 w-5 accent-[var(--color-brand)]"
            />
            Athlete enters their own bar weight (Smith machine etc.)
          </label>
          <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">
            Add lift
          </button>
        </form>
      </Card>
    </Screen>
  );
}
