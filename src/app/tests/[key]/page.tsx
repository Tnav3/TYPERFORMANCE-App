import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { getEntries, getTestDefs } from "@/lib/test-data";
import { MAS_MODES, TEST_FIELDS, masModeOf, masOf, masTargets, pace500, youtubeId } from "@/lib/testing";
import { BackLink, Card, Heading, Screen } from "@/components/ui";
import { TestEntryForm } from "@/components/TestEntryForm";
import { TestEntryList } from "@/components/TestEntryList";

export default async function TestPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { supabase, user } = await requireState(["athlete", "coach"]);
  const { key } = await params;
  if (!TEST_FIELDS[key]) notFound();
  const [defs, entries, { data: lastBw }] = await Promise.all([
    getTestDefs(supabase),
    getEntries(supabase, user!.id, key),
    supabase
      .from("weekly_checkins")
      .select("bodyweight_kg")
      .eq("athlete_id", user!.id)
      .not("bodyweight_kg", "is", null)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const def = defs.find((d) => d.key === key);
  if (!def) notFound();
  const vid = youtubeId(def.youtube_url);
  const isField = def.mode === "field";
  const latest = entries[entries.length - 1];

  return (
    <Screen>
      <BackLink href="/tests" label="Testing" />
      <Heading>{def.name}</Heading>

      {isField && (vid || def.instructions) && (
        <Card className="mb-4 !p-0 overflow-hidden">
          {vid && (
            <div className="aspect-video w-full bg-black">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${vid}?rel=0`}
                title={`${def.name} demo`}
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {def.instructions && (
            <div className="p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                How to do it
              </h2>
              <p className="whitespace-pre-line text-[15px] leading-relaxed">
                {def.instructions}
              </p>
            </div>
          )}
        </Card>
      )}

      {latest && masOf(key, latest.values) && (
        <MasTargets testKey={key} values={latest.values} />
      )}

      {isField ? (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-black uppercase">Enter result</h2>
          <TestEntryForm
            testKey={key}
            athleteId={user!.id}
            today={todayISO()}
            defaultBodyweight={
              lastBw?.bodyweight_kg != null
                ? Number(lastBw.bodyweight_kg)
                : null
            }
          />
        </Card>
      ) : (
        <p className="mb-6 text-sm text-muted">
          Your coach enters ForceDecks results after in-person testing.
        </p>
      )}

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
        Your results
      </h2>
      <TestEntryList
        testKey={key}
        entries={entries}
        back={`/tests/${key}`}
        canDelete={(e) => isField && e.athlete_id === user!.id}
      />
    </Screen>
  );
}

function MasTargets({
  testKey,
  values,
}: {
  testKey: string;
  values: Record<string, number>;
}) {
  const m = masOf(testKey, values);
  if (!m) return null;
  const mode = masModeOf(testKey)!;
  const spec = MAS_MODES[mode];
  return (
    <Card className="mb-4">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
        Your conditioning targets
      </h2>
      <p className="mb-3 text-sm">
        {mode === "run" ? "MAS" : `${spec.label} MAS`} <b>{m.ms} m/s</b> (
        {spec.pace500 ? `${pace500(m.ms)} /500 m` : `${m.kmh} km/h`}) from {values[spec.field]} {spec.unit}
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-1">%MAS</th>
            <th className="py-1">Speed</th>
            <th className="py-1">15 s</th>
            <th className="py-1">30 s</th>
          </tr>
        </thead>
        <tbody>
          {masTargets(m.ms).map((t) => (
            <tr key={t.pct} className="border-t border-line">
              <td className="py-1.5 font-bold">{t.pct}%</td>
              <td className="py-1.5">{spec.pace500 ? `${pace500(t.ms)} /500 m` : mode === "run" ? `${t.ms} m/s` : `${t.kmh} km/h`}</td>
              <td className="py-1.5">{t.m15} m</td>
              <td className="py-1.5">{t.m30} m</td>
            </tr>
          ))}
        </tbody>
      </table>
      <a href={`/mas?test=${mode}`} className="mt-3 inline-block text-sm font-bold underline underline-offset-4">
        Any rep length in the MAS Calculator →
      </a>
    </Card>
  );
}
