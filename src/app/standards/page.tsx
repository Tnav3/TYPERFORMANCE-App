import { redirect } from "next/navigation";
import { requireState } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { formatDate } from "@/lib/dates";
import { getEntries } from "@/lib/test-data";
import { getStandards, standardFor } from "@/lib/standards-data";
import { GROUPS, OVERVIEW, currentFor } from "@/lib/strength-standards";
import { ufcClassForLimit } from "@/lib/ufc-cmj";
import { StandardsCard } from "@/components/Standards";
import { LEVEL_COLOR } from "@/lib/standards";
import { UfcCmjCard } from "@/components/UfcCmjCard";
import { BackLink, Card, Heading, Screen } from "@/components/ui";

export default async function StandardsPage() {
  const { supabase, user, profile, state } = await requireState([
    "athlete",
    "coach",
  ]);
  const testing = hasFeature(profile, "testing");
  const rm = hasFeature(profile, "1rm");
  if (!testing && !rm) redirect("/athlete");

  const [entries, { data: maxes }, { data: lastBw }, standards] =
    await Promise.all([
      testing ? getEntries(supabase, user!.id) : Promise.resolve([]),
      rm
        ? supabase
            .from("lift_maxes")
            .select("lift_key, e1rm_kg, bodyweight_kg, saved_on, created_at")
            .eq("athlete_id", user!.id)
        : Promise.resolve({ data: [] }),
      supabase
        .from("weekly_checkins")
        .select("bodyweight_kg")
        .eq("athlete_id", user!.id)
        .not("bodyweight_kg", "is", null)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getStandards(supabase),
    ]);
  const sex = profile?.sex ?? null;
  const bw =
    lastBw?.bodyweight_kg != null ? Number(lastBw.bodyweight_kg) : null;
  // Rows with nothing to compare against, or only reachable through a
  // switched-off feature, are left out.
  const rows = OVERVIEW.filter((r) => testing || r.lifts).map((r) => {
    const st = standardFor(
      standards,
      r.testKey,
      sex,
      profile?.weight_class_limit_kg,
    );
    const cur = currentFor(r, entries, maxes ?? [], bw);
    return { ...r, st, cur };
  });
  const cmj = rows.find((r) => r.testKey === "cmj");
  const ufcDefault =
    sex && profile?.weight_class_limit_kg != null
      ? ufcClassForLimit(sex, Number(profile.weight_class_limit_kg))
      : null;

  return (
    <Screen>
      <BackLink
        href={state === "coach" ? "/" : "/tools"}
        label={state === "coach" ? "Home" : "Training Tools"}
      />
      <Heading>Strength Standards</Heading>
      <Card className="mb-6">
        <p className="text-[15px] leading-relaxed">
          Targets to work towards, based on research in combat and other trained
          athletes. <b style={{ color: LEVEL_COLOR.bronze }}>Bronze</b> is a
          solid base, <b style={{ color: LEVEL_COLOR.silver }}>Silver</b> is
          strong for a competing athlete, and{" "}
          <b style={{ color: LEVEL_COLOR.gold }}>Gold</b> is top level.
        </p>
        <p className="mt-2 text-sm text-muted">
          Each bar shows your latest result. Aim for the next medal, not all of
          them at once. Tap &ldquo;Where these numbers come from&rdquo; on any
          card to see the research.
        </p>
      </Card>

      {!sex ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">
            Add your sex in{" "}
            <a
              href="/profile"
              className="font-bold text-text underline underline-offset-4"
            >
              your profile
            </a>{" "}
            to see standards. They differ for men and women.
          </p>
        </Card>
      ) : (
        <>
          {GROUPS.map((g) => {
            const gr = rows.filter((r) => r.group === g.key);
            if (gr.length === 0) return null;
            const missing = gr.filter((r) => !r.st);
            return (
              <section key={g.key} className="mb-8">
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {g.title}
                </h2>
                <p className="mb-3 mt-1 text-sm text-muted">{g.intro}</p>
                {gr
                  .filter((r) => r.st)
                  .map((r) => (
                    <StandardsCard
                      key={r.testKey}
                      testKey={r.testKey}
                      standard={r.st}
                      value={r.cur?.value ?? null}
                      values={r.cur?.values}
                      title={r.name}
                      note={
                        r.cur
                          ? `${r.cur.from === "1rm" ? "1RM Calculator" : "Test"} ${formatDate(r.cur.on)}`
                          : undefined
                      }
                    />
                  ))}
                {g.key === "power" && testing && cmj && (
                  <UfcCmjCard
                    sex={sex}
                    defaultCode={ufcDefault?.code ?? null}
                    value={cmj.cur?.value ?? null}
                  />
                )}
                {missing.length > 0 && (
                  <p className="text-xs text-muted">
                    No standards set yet for:{" "}
                    {missing.map((r) => r.name).join(", ")}. Your coach can add
                    them.
                  </p>
                )}
              </section>
            );
          })}
        </>
      )}
    </Screen>
  );
}
