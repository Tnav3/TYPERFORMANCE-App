import Link from "next/link";
import { requireFeature } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { formatPct, getEntries, getTestDefs, summarize } from "@/lib/test-data";
import { groupByCategory, headlineValue } from "@/lib/testing";
import { BackLink, Card, Heading, Screen } from "@/components/ui";
import { LevelBadge } from "@/components/Standards";
import { getStandards, standardFor } from "@/lib/standards-data";
import { entryMetric, levelOf } from "@/lib/standards";

export default async function TestsHome() {
  const { supabase, user, profile } = await requireFeature(
    ["athlete", "coach"],
    "testing",
  );
  const [defs, entries, standards] = await Promise.all([
    getTestDefs(supabase),
    getEntries(supabase, user!.id),
    getStandards(supabase),
  ]);
  const levelFor = (
    key: string,
    e: Parameters<typeof entryMetric>[1] | null,
  ) => {
    const st = standardFor(standards, key, profile?.sex);
    const v = e ? entryMetric(key, e) : null;
    return st && v != null ? levelOf(v, st) : null;
  };
  const summaries = summarize(
    defs.filter((d) => d.active),
    entries,
  );
  const field = summaries.filter((s) => s.def.mode === "field");
  const groups = groupByCategory(
    field.map((s) => ({ ...s, category: s.def.category })),
  );
  const fd = summaries.filter((s) => s.def.mode === "forcedecks" && s.latest);

  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading sub="Watch the video, follow the steps, then enter your best result.">
        Testing
      </Heading>

      <Link
        href="/standards"
        className="mb-6 inline-block text-sm font-bold underline underline-offset-4"
      >
        See all your Strength Standards →
      </Link>

      {groups.map((g, i) => (
        <section key={g.label} className={i > 0 ? "mt-8" : ""}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            {g.label}
          </h2>
          <div className="space-y-2">
            {g.items.map((s) => {
              const h = s.latest
                ? headlineValue(s.def.key, s.latest.values)
                : null;
              return (
                <Link
                  key={s.def.key}
                  href={`/tests/${s.def.key}`}
                  className="block"
                >
                  <Card className="flex items-center justify-between gap-3 !p-4 hover:border-muted">
                    <div className="min-w-0">
                      <p className="font-extrabold">{s.def.name}</p>
                      {(() => {
                        const lv = levelFor(s.def.key, s.latest);
                        return lv && lv !== "below" ? (
                          <span className="mt-1 inline-block">
                            <LevelBadge level={lv} />
                          </span>
                        ) : null;
                      })()}
                      <p className="text-sm text-muted">
                        {s.latest
                          ? `Last: ${formatDate(s.latest.tested_on)}`
                          : "Not done yet"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {h ? (
                        <>
                          <p className="text-lg font-black">
                            {h.value}{" "}
                            <span className="text-xs font-normal text-muted">
                              {h.unit}
                            </span>
                          </p>
                          {s.vsFirst != null && (
                            <p className="text-xs text-muted">
                              {formatPct(s.vsFirst)} since intake
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-sm font-bold text-brand">
                          Do test →
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {fd.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-widest text-muted">
            In-person (ForceDecks)
          </h2>
          <div className="space-y-2">
            {fd.map((s) => {
              const h = headlineValue(s.def.key, s.latest!.values);
              return (
                <Link
                  key={s.def.key}
                  href={`/tests/${s.def.key}`}
                  className="block"
                >
                  <Card className="flex items-center justify-between !p-4 hover:border-muted">
                    <div>
                      <p className="font-extrabold">{s.def.name}</p>
                      <p className="text-sm text-muted">
                        {formatDate(s.latest!.tested_on)}
                      </p>
                    </div>
                    {h && (
                      <p className="text-lg font-black">
                        {h.value}{" "}
                        <span className="text-xs font-normal text-muted">
                          {h.unit}
                        </span>
                      </p>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </Screen>
  );
}
