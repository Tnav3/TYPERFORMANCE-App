import Link from "next/link";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { byYear, recordOf, recordString, type Fight } from "@/lib/fights";
import { BackLink, Card, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CoachFights({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const today = todayISO();
  const [{ data: fightsData }, { data: people }] = await Promise.all([
    supabase
      .from("fights")
      .select("id, athlete_id, fought_on, result, rounds, created_at"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "athlete"),
  ]);
  const fights = (fightsData ?? []) as Fight[];
  const years = byYear(fights);
  const { year: y } = await searchParams;
  const year = Number(y) || years[0]?.year || Number(today.slice(0, 4));
  const inYear = fights.filter((f) => f.fought_on.startsWith(`${year}-`));
  const yearRecord = recordOf(inYear);
  const name = Object.fromEntries(
    (people ?? []).map((p) => [p.id, p.full_name ?? p.email]),
  );
  const perAthlete = [...new Set(inYear.map((f) => f.athlete_id))]
    .map((id) => ({
      id,
      name: name[id] ?? "Unknown",
      ...recordOf(inYear.filter((f) => f.athlete_id === id)),
    }))
    .sort(
      (a, b) =>
        b.wins - a.wins || b.fights - a.fights || a.name.localeCompare(b.name),
    );

  return (
    <Screen wide>
      <BackLink href="/coach" label="Dashboard" />
      <Heading sub="Wins, losses, draws and rounds across all your clients.">
        Competition Tracker
      </Heading>

      {years.length === 0 ? (
        <p className="text-muted">No fights logged yet.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {years.map((r) => (
              <Link
                key={r.year}
                href={`/coach/fights?year=${r.year}`}
                aria-current={r.year === year ? "page" : undefined}
                className={`min-h-11 rounded-full border px-4 py-2 text-sm font-bold ${
                  r.year === year
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface-2 text-muted"
                }`}
              >
                {r.year}
              </Link>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="!p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                {year} record
              </p>
              <p className="text-3xl font-black">{recordString(yearRecord)}</p>
              <p className="text-xs text-muted">W-L-D</p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                Fights
              </p>
              <p className="text-3xl font-black">{yearRecord.fights}</p>
              <p className="text-xs text-muted">in {year}</p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                Rounds
              </p>
              <p className="text-3xl font-black">{yearRecord.rounds}</p>
              <p className="text-xs text-muted">
                {yearRecord.fights
                  ? `${Math.round((yearRecord.rounds / yearRecord.fights) * 10) / 10} per fight`
                  : ""}
              </p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                Fighters
              </p>
              <p className="text-3xl font-black">{perAthlete.length}</p>
              <p className="text-xs text-muted">fought in {year}</p>
            </Card>
          </div>

          <Card className="mb-6 !p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
              By client · {year}
            </h2>
            <ul className="divide-y divide-line">
              {perAthlete.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/coach/athlete/${a.id}/fights`}
                    className="flex min-h-12 items-center justify-between gap-3 py-2"
                  >
                    <span className="truncate font-bold">{a.name}</span>
                    <span className="shrink-0 text-right">
                      <span className="text-lg font-black">
                        {recordString(a)}
                      </span>
                      <span className="ml-2 text-xs text-muted">
                        {a.rounds} rd{a.rounds === 1 ? "" : "s"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {years.length > 1 && (
            <Card className="!p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                Year on year · all clients
              </h2>
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-1">Year</th>
                    <th className="py-1">W-L-D</th>
                    <th className="py-1">Fights</th>
                    <th className="py-1">Rounds</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((r) => (
                    <tr key={r.year} className="border-t border-line">
                      <td className="py-1.5 font-bold">{r.year}</td>
                      <td className="py-1.5 font-black">{recordString(r)}</td>
                      <td className="py-1.5">{r.fights}</td>
                      <td className="py-1.5">{r.rounds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
