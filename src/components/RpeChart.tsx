"use client";
import { useState } from "react";
import {
  REP_ROWS,
  RIR_SCALE,
  RPE_COLUMNS,
  e1rmFromRpe,
  pctFor,
  roundTo2_5,
} from "@/lib/intensity";

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

const RIR_OF: Record<number, string> = {
  10: "0",
  9.5: "0–1",
  9: "1",
  8.5: "1–2",
  8: "2",
  7.5: "2–3",
  7: "3",
  6.5: "3–4",
  6: "4+",
};
const num = (s: string) => {
  const t = s.trim().replace(",", ".");
  return t === "" ? NaN : Number(t);
};

export function RpeChart() {
  const [tab, setTab] = useState<"scale" | "pct" | "est">("scale");
  const [reps, setReps] = useState(5);
  const [oneRm, setOneRm] = useState("");
  const [set, setSet] = useState({ load: "", reps: "", rpe: "8" });

  const rm = num(oneRm);
  const rmOk = Number.isFinite(rm) && rm > 0 && rm <= 700;
  const est = e1rmFromRpe(num(set.load), num(set.reps), num(set.rpe));

  return (
    <div>
      <div
        role="tablist"
        className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface p-1"
      >
        {(
          [
            ["scale", "1. RPE ↔ RIR"],
            ["pct", "2. Set my weight"],
            ["est", "3. Find my 1RM"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`min-h-11 rounded-xl px-1 text-xs font-extrabold uppercase tracking-wide sm:text-sm ${
              tab === k ? "bg-brand text-white" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "scale" && (
        <>
          <div className="mb-5 rounded-2xl border border-line bg-surface p-4 text-sm">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
              How to use
            </p>
            <p>
              RPE is how hard a set was. RIR is how many more good reps you had
              left (Reps In Reserve).
            </p>
            <p className="mt-1.5">
              Straight after your last rep, ask:{" "}
              <b>
                &ldquo;How many more could I have done with good form?&rdquo;
              </b>{" "}
              2 more = <b>RPE 8</b>. 1 more = <b>RPE 9</b>. None = <b>RPE 10</b>
              .
            </p>
          </div>
          <table className="w-full text-left">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-semibold">RPE</th>
                <th className="py-2 pr-3 font-semibold">Reps left (RIR)</th>
                <th className="py-2 font-semibold">How it feels</th>
              </tr>
            </thead>
            <tbody>
              {RIR_SCALE.map((r) => (
                <tr key={r.rpe} className="border-b border-line/60">
                  <td className="py-2.5 pr-3 text-lg font-black">{r.rpe}</td>
                  <td className="py-2.5 pr-3 font-bold">{r.rir}</td>
                  <td className="py-2.5 text-sm text-muted">{r.feel}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">
            Zourdos et al. 2016 (J Strength Cond Res); half steps from
            Tuchscherer&apos;s RTS scale. Rate the set right after the last rep:
            how many more could you have done with good form?
          </p>
        </>
      )}

      {tab === "pct" && (
        <>
          <div className="mb-5 rounded-2xl border border-line bg-surface p-4 text-sm">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
              How to use
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Enter your 1RM (optional) to see kilos.</li>
              <li>Tap the number of reps in your set.</li>
              <li>Find the RPE your coach set. That row is your weight.</li>
            </ol>
            <p className="mt-1.5 text-muted">
              Example: 5 reps @ RPE 8 = 81.1% of your 1RM.
            </p>
          </div>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm font-semibold">
              Your 1RM{" "}
              <span className="font-normal text-muted">
                (kg, optional: shows loads)
              </span>
            </span>
            <input
              inputMode="decimal"
              value={oneRm}
              onChange={(e) => setOneRm(e.target.value)}
              placeholder="e.g. 120"
              className={inputCls}
            />
          </label>

          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            Reps in the set
          </h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {REP_ROWS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={reps === r}
                onClick={() => setReps(r)}
                className={`min-h-11 min-w-11 rounded-full border px-3 text-sm font-bold ${
                  reps === r
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface-2 text-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <table className="w-full text-left">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-2 font-semibold">RPE</th>
                <th className="py-2 pr-2 font-semibold">RIR</th>
                <th className="py-2 pr-2 font-semibold">%1RM</th>
                {rmOk && <th className="py-2 font-semibold">Load</th>}
              </tr>
            </thead>
            <tbody>
              {RPE_COLUMNS.map((rpe) => {
                const p = pctFor(reps, rpe);
                return (
                  <tr key={rpe} className="border-b border-line/60">
                    <td className="py-2.5 pr-2 font-bold">{rpe}</td>
                    <td className="py-2.5 pr-2 text-muted">{RIR_OF[rpe]}</td>
                    <td className="py-2.5 pr-2 text-lg font-black">
                      {p != null ? (
                        `${p.toFixed(1)}%`
                      ) : (
                        <span className="text-base font-normal text-muted">
                          —
                        </span>
                      )}
                    </td>
                    {rmOk && (
                      <td className="py-2.5 text-lg font-black">
                        {p != null ? (
                          `${roundTo2_5((rm * p) / 100)} kg`
                        ) : (
                          <span className="text-base font-normal text-muted">
                            —
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-bold underline underline-offset-4">
              Full chart (all reps)
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="py-1.5 pr-2">Reps</th>
                    {RPE_COLUMNS.map((c) => (
                      <th key={c} className="py-1.5 pr-2">
                        @{c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {REP_ROWS.map((r) => (
                    <tr key={r} className="border-b border-line/60">
                      <td className="py-1.5 pr-2 font-bold">{r}</td>
                      {RPE_COLUMNS.map((c) => {
                        const p = pctFor(r, c);
                        return (
                          <td key={c} className="py-1.5 pr-2">
                            {p != null ? (
                              p.toFixed(1)
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="mt-3 text-xs text-muted">
            Tuchscherer RTS chart. Estimates: rounded to 2.5 kg. &ldquo;—&rdquo;
            means more than 10 reps from failure, where published versions of
            the chart disagree.
          </p>
        </>
      )}

      {tab === "est" && (
        <>
          <div className="mb-5 rounded-2xl border border-line bg-surface p-4 text-sm">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
              How to use
            </p>
            <p>
              Enter a set you did today: weight, reps and its RPE. The app works
              out the 1RM that set points to.
            </p>
            <p className="mt-1.5 text-muted">
              Most accurate with heavy sets (1–5 reps, RPE 8 or above).
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Weight</span>
              <input
                inputMode="decimal"
                value={set.load}
                onChange={(e) => setSet({ ...set, load: e.target.value })}
                placeholder="kg"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Reps</span>
              <input
                inputMode="numeric"
                value={set.reps}
                onChange={(e) => setSet({ ...set, reps: e.target.value })}
                placeholder="1–10"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">RPE</span>
              <select
                value={set.rpe}
                onChange={(e) => setSet({ ...set, rpe: e.target.value })}
                className={`${inputCls} appearance-none`}
              >
                {RPE_COLUMNS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {set.load !== "" && set.reps !== "" && (
            <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
              {est != null ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                    Estimated 1RM
                  </p>
                  <p className="text-3xl font-black">{est} kg</p>
                  <p className="text-xs text-muted">
                    {set.reps} reps @ RPE {set.rpe} ={" "}
                    {pctFor(num(set.reps), num(set.rpe))}% of 1RM
                  </p>
                </>
              ) : (
                <p className="text-sm text-brand">
                  Use 1–10 reps, and a set no more than 10 reps from failure
                  (reps + reps in reserve).
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
