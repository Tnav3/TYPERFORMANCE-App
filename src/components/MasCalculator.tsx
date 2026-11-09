"use client";
import { useState } from "react";
import {
  MAS_CALC_PCTS,
  MAS_DURATIONS,
  MAS_MODES,
  MAS_MODE_ORDER,
  durationLabel,
  parseDuration,
  masForMode,
  pace500,
  repMetres,
  type MasMode,
} from "@/lib/testing";

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

const MAX_COLS = 3;
/** Reps this long (s) above 100 % MAS are greyed out: MAS ≈ the pace held for ~4–8 min. */
const LONG_REP = 120;
const DEFAULT_DURATIONS = [15, 30, 60];
const PLACEHOLDER: Record<MasMode, string> = { run: "e.g. 1350", bike: "e.g. 2.45", row: "e.g. 1400", ski: "e.g. 1300" };
const NOTE: Record<MasMode, string> = {
  run: "Straight-line running. Shuttles with turns lose time on each change of direction, so expect to cover a bit less.",
  bike: "The console shows km: 140 m = 0.14 km. Only use these targets on the same bike model you tested on.",
  row: "Pace is per 500 m, as shown on the monitor. Use the same rower and damper setting you tested with.",
  ski: "Pace is per 500 m, as shown on the monitor. Use the same SkiErg and damper setting you tested with.",
};

export function MasCalculator({
  initialMode,
  saved,
  canSave,
}: {
  initialMode: MasMode;
  saved: Record<MasMode, number | null>;
  canSave: boolean;
}) {
  const [mode, setMode] = useState<MasMode>(initialMode);
  const [input, setInput] = useState<Record<MasMode, string>>(
    Object.fromEntries(MAS_MODE_ORDER.map((m) => [m, saved[m] != null ? String(saved[m]) : ""])) as Record<MasMode, string>,
  );
  const [durations, setDurations] = useState<number[]>(DEFAULT_DURATIONS);
  const [custom, setCustom] = useState<number[]>([]);
  const [customText, setCustomText] = useState("");
  const [customErr, setCustomErr] = useState<string | null>(null);
  const chips = [...new Set([...MAS_DURATIONS, ...custom])].sort((a, b) => a - b);

  const spec = MAS_MODES[mode];
  const raw = input[mode].trim().replace(",", ".");
  const n = raw === "" ? NaN : Number(raw);
  const valid = Number.isFinite(n) && n >= spec.min && n <= spec.max;
  const mas = valid ? masForMode(mode, n) : null;
  const fromSaved = saved[mode] != null && Number(raw) === saved[mode];
  const cols = [...durations].sort((a, b) => a - b);

  function select(d: number) {
    setDurations((cur) => {
      if (cur.includes(d)) return cur;
      const next = [...cur, d];
      return next.length > MAX_COLS ? next.slice(next.length - MAX_COLS) : next;
    });
  }

  function toggle(d: number) {
    if (durations.includes(d)) {
      if (durations.length > 1) setDurations(durations.filter((x) => x !== d));
    } else select(d);
  }

  function addCustom() {
    const r = parseDuration(customText);
    if ("error" in r) return setCustomErr(r.error);
    setCustomErr(null);
    setCustomText("");
    if (!MAS_DURATIONS.includes(r.seconds)) setCustom((c) => (c.includes(r.seconds) ? c : [...c, r.seconds]));
    select(r.seconds);
  }

  return (
    <div>
      <div role="tablist" className="mb-5 grid grid-cols-4 gap-1 rounded-2xl border border-line bg-surface p-1">
        {MAS_MODE_ORDER.map((m) => (
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
            className={`min-h-11 rounded-xl px-1 text-xs font-extrabold uppercase tracking-wide sm:text-sm ${
              mode === m ? "bg-brand text-white" : "text-muted"
            }`}
          >
            {MAS_MODES[m].tab}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">
          {spec.label}: {spec.hint.charAt(0).toLowerCase() + spec.hint.slice(1)}{" "}
          <span className="font-normal text-muted">({spec.unit})</span>
        </span>
        <input
          inputMode="decimal"
          value={input[mode]}
          placeholder={PLACEHOLDER[mode]}
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
              {mode === "run" ? "MAS" : `${spec.label} MAS`}
            </p>
            <p className="text-3xl font-black">
              {spec.pace500 ? `${pace500(mas.ms)} /500 m` : `${mas.kmh} km/h`}
              <span className="ml-2 text-base font-bold text-muted">{mas.ms} m/s</span>
            </p>
            <p className="text-xs text-muted">= distance ÷ 300 seconds</p>
          </div>

          <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-widest text-muted">
            Rep length <span className="normal-case tracking-normal">(pick up to {MAX_COLS})</span>
          </h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {chips.map((d) => {
              const on = durations.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(d)}
                  className={`min-h-11 rounded-full border px-3.5 text-sm font-bold ${
                    on ? "border-brand bg-brand text-white" : "border-line bg-surface-2 text-muted"
                  }`}
                >
                  {durationLabel(d)}
                </button>
              );
            })}
          </div>

          <div className="mb-4">
            <div className="flex gap-2">
              <input
                value={customText}
                onChange={(e) => {
                  setCustomText(e.target.value);
                  setCustomErr(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                inputMode="text"
                placeholder="Other: 2:30 or 150"
                aria-label="Other rep length, in seconds or minutes:seconds"
                className={`${inputCls} min-h-11`}
              />
              <button
                type="button"
                onClick={addCustom}
                className="min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-4 text-sm font-extrabold uppercase"
              >
                Add
              </button>
            </div>
            {customErr && <p className="mt-1 text-sm text-brand">{customErr}</p>}
          </div>

          <table className="w-full text-left">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-2 font-semibold">%MAS</th>
                <th className="py-2 pr-2 font-semibold normal-case">{spec.pace500 ? "/500 m" : "km/h"}</th>
                {cols.map((d) => (
                  <th key={d} className="py-2 pr-2 font-semibold normal-case">
                    {durationLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MAS_CALC_PCTS.map((pct) => {
                const v = mas.ms * (pct / 100);
                return (
                  <tr key={pct} className={`border-b border-line/60 ${pct === 100 ? "bg-surface-2" : ""}`}>
                    <td className="py-2.5 pr-2 font-bold">{pct}%</td>
                    <td className="py-2.5 pr-2 text-muted">
                      {spec.pace500 ? pace500(v) : Math.round(v * 36) / 10}
                    </td>
                    {cols.map((d) => {
                      const longAboveMas = d >= LONG_REP && pct > 100;
                      return (
                        <td
                          key={d}
                          className={`py-2.5 pr-2 ${longAboveMas ? "font-normal text-muted/50" : "font-black"}`}
                        >
                          {repMetres(v, d)} m
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {cols.some((d) => d >= LONG_REP) && (
            <p className="mt-3 text-xs text-muted">
              Greyed out: reps of 2 min or longer above 100% MAS. MAS is roughly the pace you can hold for 4–8 minutes,
              so long reps above it will usually fall apart.
            </p>
          )}
          <p className="mt-3 text-xs text-muted">
            {NOTE[mode]} Targets from one machine or mode can&apos;t be swapped with another.
          </p>

          {canSave && !fromSaved && (
            <a
              href={`/tests/${spec.testKey}`}
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
