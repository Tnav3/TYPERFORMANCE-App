"use client";
import { useState } from "react";
import { MAS_CALC_PCTS, bikeMasFrom, masFrom, masTargets } from "@/lib/testing";

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export type MasMode = "run" | "bike";

const SPEC = {
  run: { label: "Run", unit: "m", min: 300, max: 3000, hint: "Metres covered in 5 minutes", test: "mas_5min" },
  bike: { label: "Assault Bike", unit: "km", min: 0.5, max: 5, hint: "Console distance at 5:00", test: "mas_bike_5min" },
} as const;

export function MasCalculator({
  initialMode,
  saved,
  canSave,
}: {
  initialMode: MasMode;
  saved: { run: number | null; bike: number | null };
  canSave: boolean;
}) {
  const [mode, setMode] = useState<MasMode>(initialMode);
  const [input, setInput] = useState<Record<MasMode, string>>({
    run: saved.run != null ? String(saved.run) : "",
    bike: saved.bike != null ? String(saved.bike) : "",
  });
  const spec = SPEC[mode];
  const raw = input[mode].trim().replace(",", ".");
  const n = raw === "" ? NaN : Number(raw);
  const valid = Number.isFinite(n) && n >= spec.min && n <= spec.max;
  const mas = valid ? (mode === "run" ? masFrom(n) : bikeMasFrom(n)) : null;
  const rows = mas ? masTargets(mas.ms, MAS_CALC_PCTS) : [];
  const fromSaved = saved[mode] != null && Number(raw) === saved[mode];

  return (
    <div>
      <div role="tablist" className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-1">
        {(["run", "bike"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              const u = new URL(window.location.href);
              u.searchParams.set("test", m);
              window.history.replaceState(null, "", u);
            }}
            className={`min-h-11 rounded-xl text-sm font-extrabold uppercase tracking-wide ${
              mode === m ? "bg-brand text-white" : "text-muted"
            }`}
          >
            {SPEC[m].label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">
          {spec.hint} <span className="font-normal text-muted">({spec.unit})</span>
        </span>
        <input
          inputMode="decimal"
          value={input[mode]}
          placeholder={mode === "run" ? "e.g. 1350" : "e.g. 2.45"}
          onChange={(e) => setInput({ ...input, [mode]: e.target.value })}
          className={inputCls}
        />
      </label>
      {raw !== "" && !valid && (
        <p className="mt-2 text-sm text-brand">
          Between {spec.min} and {spec.max} {spec.unit}
        </p>
      )}
      {fromSaved && <p className="mt-2 text-xs text-muted">From your latest saved test.</p>}

      {mas && (
        <>
          <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              {mode === "bike" ? "Bike MAS" : "MAS"}
            </p>
            <p className="text-3xl font-black">
              {mas.kmh} km/h
              <span className="ml-2 text-base font-bold text-muted">{mas.ms} m/s</span>
            </p>
            <p className="text-xs text-muted">= distance ÷ 300 seconds</p>
          </div>

          <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-widest text-muted">
            Distance to cover per rep
          </h2>
          <table className="w-full text-left">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-2 font-semibold">%MAS</th>
                <th className="py-2 pr-2 font-semibold">km/h</th>
                <th className="py-2 pr-2 font-semibold">15 s</th>
                <th className="py-2 pr-2 font-semibold">30 s</th>
                <th className="py-2 font-semibold">60 s</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pct} className={`border-b border-line/60 ${r.pct === 100 ? "bg-surface-2" : ""}`}>
                  <td className="py-2.5 pr-2 font-bold">{r.pct}%</td>
                  <td className="py-2.5 pr-2 text-muted">{r.kmh}</td>
                  <td className="py-2.5 pr-2 font-black">{r.m15} m</td>
                  <td className="py-2.5 pr-2 font-black">{r.m30} m</td>
                  <td className="py-2.5 font-black">{r.m60} m</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">
            {mode === "bike"
              ? "The console shows km: 140 m = 0.14 km. Bike targets only apply to the same bike model you tested on, and can't be swapped with run targets."
              : "Straight-line running. Shuttles with turns lose time on each change of direction, so expect to cover a bit less."}
          </p>

          {canSave && !fromSaved && (
            <a
              href={`/tests/${spec.test}`}
              className="mt-5 flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm font-extrabold uppercase tracking-wide"
            >
              Save as a test result →
            </a>
          )}
        </>
      )}
    </div>
  );
}
