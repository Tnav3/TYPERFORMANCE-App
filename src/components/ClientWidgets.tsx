import Link from "next/link";
import type { WidgetData } from "@/lib/programming/widgets-data";
import { WIDGETS, type HomeTrend, type WidgetKey } from "@/lib/programming/widgets";
import { MiniChart } from "./MiniChart";
import { setClientWidgets, setHomeTrend } from "@/app/coach/widget-actions";

function fmt(v: number | null, unit: string) {
  if (v == null) return "–";
  const n = Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10);
  return unit === "%" ? `${n}%` : n;
}

export function Delta({ w }: { w: WidgetData }) {
  if (w.diff == null || w.diff === 0) return <span className="text-xs text-muted">{w.kind === "bars" ? "same as week before" : "no change yet"}</span>;
  const up = w.diff > 0;
  const txt = w.unit === "%" || w.unit === "/wk" || w.unit === "/100" ? `${up ? "+" : ""}${w.diff}${w.unit === "%" ? " pts" : ""}` : w.pct != null && w.kind === "bars" ? `${up ? "+" : ""}${w.pct}%` : `${up ? "+" : ""}${w.diff} kg`;
  return (
    <span className="text-xs font-bold text-muted">
      <span aria-hidden>{up ? "▲" : "▼"}</span> {txt} <span className="font-normal">{w.kind === "bars" ? "vs week before" : "in 8 wks"}</span>
    </span>
  );
}

export function ClientWidgets({ id, widgets, chosen, trend, trendAuto }: { id: string; widgets: WidgetData[]; chosen: WidgetKey[]; trend: HomeTrend | null; trendAuto: HomeTrend }) {
  return (
    <section className="mb-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {widgets.map((w) => (
          <Link key={w.key} href={`/coach/athlete/${id}/progress`} className="block rounded-xl border border-line bg-surface p-3 hover:border-brand/60">
            <p className="truncate text-xs font-bold uppercase tracking-wide text-muted">{w.title}</p>
            <p className="mt-1 text-2xl font-extrabold leading-none">
              {fmt(w.latest, w.unit)}
              {w.unit !== "%" && w.latest != null && <span className="ml-1 text-xs font-bold text-muted">{w.unit}</span>}
            </p>
            <div className="mt-1 min-h-4">{w.note ? <span className="text-xs text-muted">{w.note}</span> : <Delta w={w} />}</div>
            <MiniChart points={w.points} kind={w.kind} className="mt-2" />
          </Link>
        ))}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-right text-xs font-bold text-muted">Choose graphs</summary>
        <form action={setClientWidgets} className="mt-2 rounded-xl border border-line bg-surface p-3">
          <input type="hidden" name="id" value={id} />
          <p className="mb-2 text-sm text-muted">Pick up to 4. Saved for this client only.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {WIDGETS.map(([k, label, hint]) => (
              <label key={k} className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-surface-2 px-3">
                <input type="checkbox" name="w" value={k} defaultChecked={chosen.includes(k)} className="size-5 accent-[var(--color-brand,#e10600)]" />
                <span className="text-sm">
                  <span className="font-bold">{label}</span> <span className="text-muted">· {hint}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="reset" value="1" className="size-4" /> Back to defaults
            </label>
            <button className="min-h-11 rounded-xl bg-brand px-4 font-extrabold text-white">Save</button>
          </div>
        </form>
        <form action={setHomeTrend} className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
          <input type="hidden" name="id" value={id} />
          <label htmlFor="trend" className="text-sm font-bold">Graph on their home screen</label>
          <select id="trend" name="trend" defaultValue={trend ?? "auto"} className="min-h-11 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-text">
            <option value="auto">Automatic ({trendAuto})</option>
            <option value="strength">Strength</option>
            <option value="bodyweight">Bodyweight</option>
            <option value="volume">Training volume</option>
            <option value="off">Off</option>
          </select>
          <button className="min-h-11 rounded-xl border border-line bg-surface-2 px-4 text-sm font-bold">Save</button>
        </form>
      </details>
    </section>
  );
}
