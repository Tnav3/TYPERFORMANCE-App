import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import {
  formatPct,
  getEntries,
  getTestDefs,
  summarize,
  type TestEntry,
} from "@/lib/test-data";
import {
  DSI_LABEL,
  derivedFor,
  dsiFrom,
  headlineValue,
  masFrom,
  masOf,
  pace500,
  MAS_MODES,
} from "@/lib/testing";
import { BackLink, Card, Screen } from "@/components/ui";
import { ForceDecksDayForm } from "@/components/ForceDecksDayForm";
import { CoachFieldTestForm } from "@/components/CoachFieldTestForm";
import { TestEntryList } from "@/components/TestEntryList";
import { getLifts, getMaxes } from "@/lib/lift-data";
import { latestMaxes } from "@/lib/calculator";
import { deleteLiftMax } from "@/app/calculator/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DSI from a CMJ and IMTP on the same day (most recent such day). */
function latestDsi(entries: TestEntry[]) {
  const cmj = entries.filter(
    (e) => e.test_key === "cmj" && e.values.peak_force_n,
  );
  const imtp = entries.filter(
    (e) => e.test_key === "imtp" && e.values.peak_force_n,
  );
  const days = [...new Set(cmj.map((e) => e.tested_on))]
    .filter((d) => imtp.some((i) => i.tested_on === d))
    .sort();
  return days.map((d) => {
    const c = cmj.filter((e) => e.tested_on === d).at(-1)!;
    const i = imtp.filter((e) => e.tested_on === d).at(-1)!;
    return {
      date: d,
      cmj: c.values.peak_force_n,
      imtp: i.values.peak_force_n,
      dsi: dsiFrom(c.values.peak_force_n, i.values.peak_force_n)!,
    };
  });
}

export default async function CoachAthleteTests({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [{ data: p }, defs, entries, { data: lastBw }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", id)
      .eq("role", "athlete")
      .maybeSingle(),
    getTestDefs(supabase),
    getEntries(supabase, id),
    supabase
      .from("weekly_checkins")
      .select("bodyweight_kg")
      .eq("athlete_id", id)
      .not("bodyweight_kg", "is", null)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!p) notFound();
  const [lifts, maxes] = await Promise.all([getLifts(supabase), getMaxes(supabase, id)]);
  const liftNames = Object.fromEntries(lifts.map((l) => [l.key, l.name]));
  const currentMaxes = Object.values(latestMaxes(maxes)).sort((a, b) =>
    (liftNames[a.lift_key] ?? "").localeCompare(liftNames[b.lift_key] ?? ""),
  );
  const today = todayISO();
  const summaries = summarize(defs, entries);
  const dsiHistory = latestDsi(entries);
  const dsiNow = dsiHistory.at(-1);
  const mas = summaries.find((s) => s.def.key === "mas_5min")?.latest;
  const machineMas = (["bike", "row", "ski"] as const)
    .map((m) => ({ m, e: summaries.find((s) => s.def.key === MAS_MODES[m].testKey)?.latest }))
    .filter((x) => x.e);

  // Signed links (1 hour) so the coach can watch private clips
  const paths = entries
    .filter((e) => e.video_path)
    .map((e) => e.video_path!) as string[];
  const videoUrls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await supabase.storage
      .from("test-videos")
      .createSignedUrls(paths, 3600);
    for (const e of entries) {
      const s = data?.find((x) => x.path === e.video_path);
      if (s?.signedUrl) videoUrls[e.id] = s.signedUrl;
    }
  }
  const back = `/coach/athlete/${id}/tests`;
  const withResults = summaries.filter((s) => s.latest);

  return (
    <Screen wide>
      <BackLink
        href={`/coach/athlete/${id}`}
        label={p.full_name ?? "Athlete"}
      />
      <h1 className="mb-6 text-2xl font-black uppercase tracking-tight">
        Testing · {p.full_name ?? p.email}
      </h1>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            DSI
          </p>
          {dsiNow ? (
            <>
              <p className="mt-1 text-3xl font-black">{dsiNow.dsi.value}</p>
              <p className="font-bold">{DSI_LABEL[dsiNow.dsi.band]}</p>
              <p className="text-xs text-muted">
                CMJ {dsiNow.cmj} N ÷ IMTP {dsiNow.imtp} N ·{" "}
                {formatDate(dsiNow.date)}
                {dsiHistory.length > 1 &&
                  ` · was ${dsiHistory.at(-2)!.dsi.value} on ${formatDate(dsiHistory.at(-2)!.date)}`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Needs a CMJ peak force and IMTP peak force from the same day.
            </p>
          )}
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            MAS
          </p>
          {mas ? (
            <>
              <p className="mt-1 text-3xl font-black">
                {masFrom(mas.values.distance_m).ms} m/s
              </p>
              <p className="font-bold">
                {masFrom(mas.values.distance_m).kmh} km/h
              </p>
              <p className="text-xs text-muted">
                {mas.values.distance_m} m in 5 min · {formatDate(mas.tested_on)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">No 5-minute run test yet.</p>
          )}
          {machineMas.map(({ m, e }) => {
            const spec = MAS_MODES[m];
            const v = masOf(spec.testKey, e!.values)!;
            return (
              <p key={m} className="mt-3 border-t border-line pt-2 text-sm">
                <span className="font-bold">{spec.label}: </span>
                {spec.pace500 ? `${pace500(v.ms)} /500 m` : `${v.kmh} km/h`}
                <span className="block text-xs text-muted">
                  {e!.values[spec.field]} {spec.unit} in 5 min · {formatDate(e!.tested_on)}
                </span>
              </p>
            );
          })}
        </Card>
      </div>

      <Card className="mb-6 overflow-x-auto">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Results · intake vs latest
        </h2>
        {withResults.length === 0 ? (
          <p className="text-sm text-muted">No tests entered yet.</p>
        ) : (
          <>
            <ul className="space-y-3 sm:hidden">
              {withResults.map((s) => {
                const h = (e: TestEntry | null) =>
                  e ? headlineValue(s.def.key, e.values) : null;
                const bw =
                  s.latest!.bodyweight_kg != null
                    ? Number(s.latest!.bodyweight_kg)
                    : null;
                const derived = derivedFor(s.def.key, s.latest!.values, bw);
                return (
                  <li key={s.def.key} className="border-t border-line pt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-bold">{s.def.name}</p>
                      <p className="shrink-0">
                        <b>{h(s.latest)?.value}</b>{" "}
                        <span className="text-xs text-muted">{s.unit}</span>
                      </p>
                    </div>
                    <p className="text-xs text-muted">
                      Latest {formatDate(s.latest!.tested_on)} · intake{" "}
                      {h(s.first)?.value} ({formatDate(s.first!.tested_on)})
                    </p>
                    {s.entries.length > 1 && (
                      <p className="text-sm">
                        {formatPct(s.vsPrevious)} vs prev ·{" "}
                        {formatPct(s.vsFirst)} vs intake
                      </p>
                    )}
                    {derived.length > 0 && (
                      <p className="text-xs text-muted">
                        {derived
                          .map((d) => `${d.label} ${d.value}`)
                          .join(" · ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            <table className="hidden w-full text-left text-sm sm:table">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 pr-3">Test</th>
                  <th className="py-1 pr-3">Intake</th>
                  <th className="py-1 pr-3">Latest</th>
                  <th className="py-1 pr-3">vs prev</th>
                  <th className="py-1 pr-3">vs intake</th>
                  <th className="py-1">Derived (latest)</th>
                </tr>
              </thead>
              <tbody>
                {withResults.map((s) => {
                  const h = (e: TestEntry | null) =>
                    e ? headlineValue(s.def.key, e.values) : null;
                  const bw =
                    s.latest!.bodyweight_kg != null
                      ? Number(s.latest!.bodyweight_kg)
                      : null;
                  return (
                    <tr
                      key={s.def.key}
                      className="border-t border-line align-top"
                    >
                      <td className="py-2 pr-3 font-bold">{s.def.name}</td>
                      <td className="py-2 pr-3">
                        {h(s.first)?.value}{" "}
                        <span className="text-xs text-muted">
                          {formatDate(s.first!.tested_on)}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <b>{h(s.latest)?.value}</b>{" "}
                        <span className="text-xs text-muted">{s.unit}</span>
                        <span className="block text-xs text-muted">
                          {formatDate(s.latest!.tested_on)}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{formatPct(s.vsPrevious)}</td>
                      <td className="py-2 pr-3">{formatPct(s.vsFirst)}</td>
                      <td className="py-2 text-xs text-muted">
                        {derivedFor(s.def.key, s.latest!.values, bw)
                          .map((d) => `${d.label} ${d.value}`)
                          .join(" · ") || "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
        <p className="mt-3 text-xs text-muted">
          From the first retest on, judge change against this athlete&apos;s own
          baseline rather than population norms.
        </p>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 text-lg font-black uppercase">
            Enter ForceDecks session
          </h2>
          <p className="mb-4 text-sm text-muted">
            Battery order. Leave any test blank to skip it.
          </p>
          <ForceDecksDayForm athleteId={id} today={today} />
        </Card>
        <Card>
          <h2 className="mb-1 text-lg font-black uppercase">
            Enter a field test
          </h2>
          <p className="mb-4 text-sm text-muted">
            For tests you ran in person.
          </p>
          <CoachFieldTestForm
            athleteId={id}
            today={today}
            tests={defs
              .filter((d) => d.mode === "field")
              .map((d) => ({ key: d.key, name: d.name }))}
            defaultBodyweight={
              lastBw?.bodyweight_kg != null
                ? Number(lastBw.bodyweight_kg)
                : null
            }
          />
        </Card>
      </div>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
        Saved e1RMs (from the calculator)
      </h2>
      <Card className="mb-8 !p-0">
        {currentMaxes.length === 0 ? (
          <p className="p-4 text-sm text-muted">None saved yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {currentMaxes.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-extrabold">{liftNames[m.lift_key] ?? m.lift_key}</p>
                  <p className="text-xs text-muted">
                    {m.load_kg} kg × {m.reps}
                    {m.bodyweight_kg != null ? ` at ${m.bodyweight_kg} kg BW` : ""} ·{" "}
                    {formatDate(m.saved_on)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-lg font-black">{+m.e1rm_kg.toFixed(2)} kg</span>
                  <details className="relative">
                    <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center text-muted" aria-label="Delete">
                      ✕
                    </summary>
                    <form action={deleteLiftMax} className="absolute right-0 z-10 mt-1">
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="next" value={back} />
                      <button className="min-h-11 whitespace-nowrap rounded-xl border border-brand/60 bg-surface px-3 text-sm font-bold text-brand">
                        Delete
                      </button>
                    </form>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
        History by test
      </h2>
      <div className="space-y-4">
        {withResults.map((s) => (
          <Card key={s.def.key} className="!p-4">
            <h3 className="mb-3 font-extrabold">{s.def.name}</h3>
            <TestEntryList
              testKey={s.def.key}
              entries={s.entries}
              back={back}
              canDelete={() => true}
              videoUrls={videoUrls}
              coachView
            />
          </Card>
        ))}
      </div>
    </Screen>
  );
}
