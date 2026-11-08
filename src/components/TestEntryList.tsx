import { deleteTestEntry, deleteTestVideo } from "@/app/tests/actions";
import { formatDate } from "@/lib/dates";
import { TEST_FIELDS, derivedFor } from "@/lib/testing";
import type { TestEntry } from "@/lib/test-data";

/** Newest-first history for one test. */
export function TestEntryList({
  testKey,
  entries,
  back,
  canDelete,
  videoUrls = {},
  coachView = false,
}: {
  testKey: string;
  entries: TestEntry[];
  back: string;
  canDelete: (e: TestEntry) => boolean;
  videoUrls?: Record<string, string>;
  coachView?: boolean;
}) {
  if (!entries.length)
    return <p className="text-sm text-muted">No results yet.</p>;
  const fields = TEST_FIELDS[testKey] ?? [];
  const firstId = entries[0]?.id;
  return (
    <ul className="space-y-2">
      {[...entries].reverse().map((e) => {
        const bw = e.bodyweight_kg != null ? Number(e.bodyweight_kg) : null;
        return (
          <li
            key={e.id}
            className="rounded-xl border border-line bg-surface p-3"
          >
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <p className="font-extrabold">
                {formatDate(e.tested_on)}
                {e.id === firstId && entries.length > 1 && (
                  <span className="ml-2 text-xs font-normal text-muted">
                    Intake
                  </span>
                )}
              </p>
              {bw != null && <p className="text-xs text-muted">{bw} kg BW</p>}
            </div>
            <p className="text-sm">
              {fields
                .filter((f) => e.values[f.key] != null)
                .map(
                  (f) =>
                    `${f.label}: ${e.values[f.key]}${f.unit ? " " + f.unit : ""}`,
                )
                .join(" · ")}
            </p>
            {derivedFor(testKey, e.values, bw).length > 0 && (
              <p className="text-sm text-muted">
                {derivedFor(testKey, e.values, bw)
                  .map((d) => `${d.label} ${d.value}`)
                  .join(" · ")}
              </p>
            )}
            {e.notes && <p className="mt-1 text-xs text-muted">“{e.notes}”</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {e.video_path &&
                (videoUrls[e.id] ? (
                  <a
                    href={videoUrls[e.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm font-bold"
                  >
                    ▶ Watch clip
                  </a>
                ) : (
                  <span className="text-xs text-muted">Clip uploaded</span>
                ))}
              {coachView && e.video_path && (
                <form action={deleteTestVideo}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="back" value={back} />
                  <button className="min-h-11 rounded-xl border border-line px-3 text-sm text-muted">
                    Delete clip (keep result)
                  </button>
                </form>
              )}
              {canDelete(e) && (
                // Two-step delete without JS dialogs: open, then confirm
                <details className="ml-auto">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-sm text-brand">
                    Delete
                  </summary>
                  <form action={deleteTestEntry} className="mt-1">
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="back" value={back} />
                    <button className="min-h-11 rounded-xl border border-brand/60 px-3 text-sm font-bold text-brand">
                      Yes, delete this result
                    </button>
                  </form>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
