import { formatDate } from "@/lib/dates";
import {
  REGIONS,
  assess,
  fmt,
  latestByMeasure,
  type RomEntry,
  type RomMeasure,
} from "@/lib/mobility";
import { deleteRom } from "@/app/mobility/actions";
import { Card } from "./ui";

const side = (s: "left" | "right") => (s === "left" ? "Left" : "Right");

/** Latest result per measure, grouped by body region, against its norm. */
export function RomSummary({
  measures,
  entries,
  showUntested,
}: {
  measures: RomMeasure[];
  entries: RomEntry[];
  /** Coach view: list every measure, tested or not. */
  showUntested?: boolean;
}) {
  const latest = latestByMeasure(entries);
  const groups = REGIONS.map((r) => ({
    ...r,
    items: measures.filter(
      (m) => m.region === r.key && (showUntested || latest[m.key]),
    ),
  })).filter((g) => g.items.length);

  if (!groups.length)
    return (
      <Card className="mb-6">
        <p className="text-sm text-muted">No results yet.</p>
      </Card>
    );

  return (
    <>
      {groups.map((g) => (
        <section key={g.key} className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            {g.title}
          </h2>
          <div className="space-y-2">
            {g.items.map((m) => {
              const e = latest[m.key];
              const a = e ? assess(m, e) : null;
              return (
                <Card key={m.key} className="!p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-extrabold leading-tight">{m.name}</p>
                      <p className="text-xs text-muted">
                        Norm {m.norm_text ?? "not set"}
                        {e ? ` · ${formatDate(e.measured_on)}` : ""}
                      </p>
                    </div>
                    {a && a.status !== "no_norm" && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${
                          a.status === "within"
                            ? "bg-ok/15 text-ok"
                            : "bg-warn/15 text-warn"
                        }`}
                      >
                        {a.status === "within" ? "Within norm" : "Below norm"}
                      </span>
                    )}
                  </div>
                  {e ? (
                    <p className="mt-2 text-lg font-black">
                      {m.sided ? (
                        <>
                          <span
                            className={
                              a?.belowSides.includes("left") ? "text-warn" : ""
                            }
                          >
                            L {fmt(e.left_value!, m)}
                          </span>
                          <span className="mx-2 text-muted">·</span>
                          <span
                            className={
                              a?.belowSides.includes("right") ? "text-warn" : ""
                            }
                          >
                            R {fmt(e.right_value!, m)}
                          </span>
                        </>
                      ) : (
                        <span
                          className={a?.status === "below" ? "text-warn" : ""}
                        >
                          {fmt(e.value!, m)}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Not tested yet</p>
                  )}
                  {a?.asymFlag && a.asymmetry && (
                    <p className="mt-1 text-sm font-bold text-warn">
                      {side(a.asymmetry.weaker)} is{" "}
                      {m.unit === "cm"
                        ? `${a.asymmetry.gap} cm`
                        : `${Math.round(a.asymmetry.pct)}%`}{" "}
                      lower than{" "}
                      {a.asymmetry.weaker === "left" ? "right" : "left"}
                    </p>
                  )}
                  {m.source && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-muted underline underline-offset-4">
                        Where the norm comes from
                      </summary>
                      <p className="mt-1 text-xs text-muted">{m.source}</p>
                    </details>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

/** Every saved result, newest first, with delete. */
export function RomHistory({
  measures,
  entries,
  canDelete,
  back,
}: {
  measures: RomMeasure[];
  entries: RomEntry[];
  canDelete: (e: RomEntry) => boolean;
  back: string;
}) {
  const byKey = Object.fromEntries(measures.map((m) => [m.key, m]));
  if (!entries.length) return null;
  return (
    <details className="mb-6 rounded-xl border border-line bg-surface">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-extrabold">
        All results ({entries.length})
      </summary>
      <ul className="divide-y divide-line border-t border-line">
        {entries.map((e) => {
          const m = byKey[e.measure_key];
          if (!m) return null;
          return (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <span>
                <span className="font-bold">{m.name}</span>{" "}
                <span className="text-muted">
                  {formatDate(e.measured_on)} ·{" "}
                  {m.sided
                    ? `L ${fmt(e.left_value!, m)} · R ${fmt(e.right_value!, m)}`
                    : fmt(e.value!, m)}
                </span>
              </span>
              {canDelete(e) && (
                <form action={deleteRom}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="next" value={back} />
                  <button className="text-xs font-bold text-brand">
                    Delete
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
