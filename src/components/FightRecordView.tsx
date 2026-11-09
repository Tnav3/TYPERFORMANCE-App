import { deleteFight } from "@/app/fights/actions";
import { formatDate } from "@/lib/dates";
import {
  RESULT_LABEL,
  byYear,
  recordOf,
  recordString,
  type Fight,
} from "@/lib/fights";
import { Card } from "./ui";

const RESULT_CLS = {
  win: "bg-ok/15 text-ok",
  loss: "bg-brand/15 text-brand",
  draw: "bg-warn/15 text-warn",
} as const;

/** Record summary, per-year breakdown and history list. Server component. */
export function FightRecordView({
  fights,
  back,
  thisYear,
}: {
  fights: Fight[];
  back: string;
  thisYear: number;
}) {
  const all = recordOf(fights);
  const years = byYear(fights);
  const year = years.find((y) => y.year === thisYear);
  const sorted = [...fights].sort(
    (a, b) =>
      b.fought_on.localeCompare(a.fought_on) ||
      b.created_at.localeCompare(a.created_at),
  );

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card className="!p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            All time
          </p>
          <p className="text-3xl font-black">{recordString(all)}</p>
          <p className="text-xs text-muted">
            W-L-D · {all.rounds} round{all.rounds === 1 ? "" : "s"}
            {all.winPct != null ? ` · ${all.winPct}% wins` : ""}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            {thisYear}
          </p>
          <p className="text-3xl font-black">
            {year ? recordString(year) : "0-0-0"}
          </p>
          <p className="text-xs text-muted">
            W-L-D · {year?.rounds ?? 0} round{year?.rounds === 1 ? "" : "s"}
          </p>
        </Card>
      </div>

      {years.length > 1 && (
        <Card className="mb-6 !p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            By year
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1">Year</th>
                <th className="py-1">W-L-D</th>
                <th className="py-1">Fights</th>
                <th className="py-1">Rounds</th>
                <th className="py-1">Win %</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year} className="border-t border-line">
                  <td className="py-1.5 font-bold">{y.year}</td>
                  <td className="py-1.5 font-black">{recordString(y)}</td>
                  <td className="py-1.5">{y.fights}</td>
                  <td className="py-1.5">{y.rounds}</td>
                  <td className="py-1.5">{y.winPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
        Fights
      </h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted">No fights logged yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {sorted.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-extrabold uppercase ${RESULT_CLS[f.result]}`}
                >
                  {RESULT_LABEL[f.result]}
                </span>
                <span className="text-sm">
                  {formatDate(f.fought_on)} · {f.rounds} round
                  {f.rounds === 1 ? "" : "s"}
                </span>
              </div>
              <details className="relative">
                <summary
                  className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center text-muted"
                  aria-label="Delete"
                >
                  ✕
                </summary>
                <form
                  action={deleteFight}
                  className="absolute right-0 z-10 mt-1"
                >
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="next" value={back} />
                  <button className="min-h-11 whitespace-nowrap rounded-xl border border-brand/60 bg-surface px-3 text-sm font-bold text-brand">
                    Delete
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
