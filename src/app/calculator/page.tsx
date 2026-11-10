import { requireFeature } from "@/lib/session";
import { Tip } from "@/components/Tip";
import { getLifts, getMaxes, latestBodyweight } from "@/lib/lift-data";
import { latestMaxes } from "@/lib/calculator";
import { formatDate } from "@/lib/dates";
import { Calculator } from "@/components/Calculator";
import { BackLink, Heading, Screen } from "@/components/ui";
import { deleteLiftMax } from "./actions";

export const dynamic = "force-dynamic";

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ lift?: string }>;
}) {
  const { supabase, user, state, profile } = await requireFeature(
    ["athlete", "coach"],
    "1rm",
  );
  const { lift } = await searchParams;
  const isAthlete = state === "athlete";
  const [lifts, maxes, bw] = await Promise.all([
    getLifts(supabase),
    isAthlete ? getMaxes(supabase, user!.id) : Promise.resolve([]),
    isAthlete ? latestBodyweight(supabase, user!.id) : Promise.resolve(null),
  ]);
  const latest = latestMaxes(maxes);
  const names = Object.fromEntries(lifts.map((l) => [l.key, l.name]));
  const savedList = Object.values(latest).sort((a, b) =>
    (names[a.lift_key] ?? "").localeCompare(names[b.lift_key] ?? ""),
  );

  return (
    <Screen>
      <BackLink
        href={state === "coach" ? "/" : "/tools"}
        label={state === "coach" ? "Home" : "Training Tools"}
      />
      <Heading sub="Enter a set you did, get your estimated 1RM and the load for each %.">
        1RM Calculator
      </Heading>
      <Tip profile={profile} tipKey="calculator" />

      <Calculator
        key={lift ?? ""}
        lifts={lifts}
        saved={Object.fromEntries(
          Object.entries(latest).map(([k, v]) => [
            k,
            {
              e1rm_kg: v.e1rm_kg,
              saved_on: v.saved_on,
              bodyweight_kg: v.bodyweight_kg,
            },
          ]),
        )}
        initialLift={lift ?? null}
        defaultBodyweight={bw}
        canSave={isAthlete}
      />

      {savedList.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            My saved e1RMs
          </h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {savedList.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <a href={`/calculator?lift=${m.lift_key}`} className="min-w-0">
                  <p className="font-extrabold">
                    {names[m.lift_key] ?? m.lift_key}
                  </p>
                  <p className="text-xs text-muted">
                    {m.load_kg} kg × {m.reps}
                    {m.bodyweight_kg != null
                      ? ` at ${m.bodyweight_kg} kg BW`
                      : ""}{" "}
                    · {formatDate(m.saved_on)}
                  </p>
                </a>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-lg font-black">
                    {+m.e1rm_kg.toFixed(2)} kg
                  </span>
                  <details className="relative">
                    <summary
                      className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center text-muted"
                      aria-label="Delete"
                    >
                      ✕
                    </summary>
                    <form
                      action={deleteLiftMax}
                      className="absolute right-0 z-10 mt-1"
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="next" value="/calculator" />
                      <button className="min-h-11 whitespace-nowrap rounded-xl border border-brand/60 bg-surface px-3 text-sm font-bold text-brand">
                        Delete
                      </button>
                    </form>
                  </details>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Deleting removes the newest entry; an older one for that lift (if
            any) becomes current.
          </p>
        </section>
      )}
    </Screen>
  );
}
