import { requireState } from "@/lib/session";
import { getTestDefs } from "@/lib/test-data";
import { getStandards } from "@/lib/standards-data";
import { STANDARD_METRICS, LEVEL_COLOR } from "@/lib/standards";
import { groupByCategory } from "@/lib/testing";
import { BackLink, Card, Heading, Screen } from "@/components/ui";
import { saveStandard } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-2 text-center text-text focus:border-brand focus:outline-none";

export default async function StandardsSettings({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; at?: string; saved?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { error, at, saved } = await searchParams;
  const [defs, standards] = await Promise.all([
    getTestDefs(supabase),
    getStandards(supabase),
  ]);
  const tests = defs.filter((d) => STANDARD_METRICS[d.key]);
  const groups = [
    ...groupByCategory(tests.filter((d) => d.mode === "field")),
    {
      category: null,
      label: "ForceDecks",
      items: tests.filter((d) => d.mode === "forcedecks"),
    },
  ].filter((g) => g.items.length);

  return (
    <Screen wide>
      <BackLink href="/coach/settings" label="Settings" />
      <Heading sub="Leave a box blank to skip that level. Clients only see standards for tests you've filled in.">
        Testing Standards
      </Heading>

      {groups.map((g) => (
        <section key={g.label} className="mb-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            {g.label}
          </h2>
          <div className="space-y-3">
            {g.items.map((d) => {
              const m = STANDARD_METRICS[d.key];
              return (
                <Card key={d.key} className="scroll-mt-6 !p-4">
                  <div id={d.key} className="mb-2">
                    <p className="font-extrabold">{d.name}</p>
                    <p className="text-xs text-muted">
                      {m.label}
                      {m.unit ? ` (${m.unit})` : ""} · higher is better
                    </p>
                  </div>
                  {at === d.key && error && (
                    <p className="mb-2 text-sm font-bold text-brand">{error}</p>
                  )}
                  {(["male", "female"] as const).map((sex) => {
                    const st = standards[`${d.key}:${sex}`];
                    return (
                      <form
                        key={sex}
                        action={saveStandard}
                        className="mb-2 border-t border-line pt-2"
                      >
                        <input type="hidden" name="test_key" value={d.key} />
                        <input type="hidden" name="sex" value={sex} />
                        <div className="grid grid-cols-[4.5rem_1fr_1fr_1fr_auto] items-center gap-2">
                          <span className="text-sm font-bold">
                            {sex === "male" ? "Men" : "Women"}
                          </span>
                          {(["bronze", "silver", "gold"] as const).map((l) => (
                            <label key={l} className="block">
                              <span
                                className="mb-0.5 block text-center text-[10px] font-extrabold uppercase"
                                style={{ color: LEVEL_COLOR[l] }}
                              >
                                {l}
                              </span>
                              <input
                                name={l}
                                inputMode="decimal"
                                defaultValue={st?.[l] ?? ""}
                                className={input}
                                aria-label={`${d.name} ${sex} ${l}`}
                              />
                            </label>
                          ))}
                          <button className="mt-4 min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold">
                            {saved === `${d.key}-${sex}` ? "Saved ✓" : "Save"}
                          </button>
                        </div>
                        <input
                          name="source"
                          defaultValue={st?.source ?? ""}
                          maxLength={500}
                          placeholder="Source / note (optional, shown to clients)"
                          className="mt-2 min-h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-xs text-text placeholder:text-muted/60 focus:border-brand focus:outline-none"
                        />
                      </form>
                    );
                  })}
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </Screen>
  );
}
