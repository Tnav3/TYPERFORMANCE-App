// Titles & belts: list with remove, plus an add form. Shown on the client's and coach's fight pages.
import { addTitle, deleteTitle } from "@/app/fights/actions";
import { TITLE_COLOURS, TITLE_ORGS, type Title } from "@/lib/titles";
import { formatDate } from "@/lib/dates";
import { TitleBadge } from "./TitleBadge";

export function TitlesEditor({ titles, athleteId, next, error, today, readOnly }: { titles: Title[]; athleteId?: string; next: string; error?: string | null; today: string; readOnly?: boolean }) {
  const box = "min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-text";
  return (
    <section id="titles" className="mb-6 scroll-mt-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Titles & belts</h2>
      <p className="mb-3 text-sm text-muted">Each one shows as a badge on the player card.</p>
      {titles.length > 0 && (
        <ul className="mb-3 divide-y divide-line">
          {titles.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2">
              <TitleBadge t={t} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{t.name || t.org}</span>
                {t.won_on && <span className="block text-xs text-muted">Won {formatDate(t.won_on)}</span>}
              </span>
              {!readOnly && (
                <form action={deleteTitle}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="next" value={next} />
                  <button className="min-h-9 px-2 text-sm font-bold text-muted hover:text-brand">Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <form action={addTitle} className="grid grid-cols-2 gap-2">
          {athleteId && <input type="hidden" name="athlete_id" value={athleteId} />}
          <input type="hidden" name="next" value={next} />
          <label className="text-xs text-muted">Organisation
            <input name="org" list="title-orgs" required maxLength={20} placeholder="WBC, ISKA…" className={box} />
            <datalist id="title-orgs">{TITLE_ORGS.map((o) => <option key={o} value={o} />)}</datalist>
          </label>
          <label className="text-xs text-muted">Badge colour
            <select name="colour" defaultValue="gold" className={box}>
              {Object.entries(TITLE_COLOURS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
            </select>
          </label>
          <label className="col-span-2 text-xs text-muted">Title (optional)
            <input name="name" maxLength={60} placeholder="Australian Welterweight" className={box} />
          </label>
          <label className="text-xs text-muted">Date won (optional)
            <input type="date" name="won_on" max={today} className={box} />
          </label>
          <div className="flex items-end">
            <button className="min-h-11 w-full rounded-xl bg-brand px-3 font-extrabold uppercase text-white">Add title</button>
          </div>
          {error && <p className="col-span-2 text-sm font-bold text-brand">{error}</p>}
        </form>
      )}
    </section>
  );
}
