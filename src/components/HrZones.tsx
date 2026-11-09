"use client";
import { useEffect, useState } from "react";
import { hrZones, tanakaHrMax, validateHr } from "@/lib/intensity";

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const KEY = "typ-hr-inputs";
const num = (s: string) => {
  const t = s.trim();
  return t === "" ? null : Number(t);
};

export function HrZones() {
  const [v, setV] = useState({ age: "", hrMax: "", rest: "" });

  // Remember the athlete's numbers on this phone (nothing is sent anywhere)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setV(JSON.parse(saved));
    } catch {}
  }, []);
  function update(k: keyof typeof v, val: string) {
    const next = { ...v, [k]: val };
    setV(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }

  const age = num(v.age);
  const measured = num(v.hrMax);
  const rest = num(v.rest);
  const touched = v.age !== "" || v.hrMax !== "" || v.rest !== "";
  const errors = validateHr({ age, hrMax: measured, rest });
  const ok = Object.keys(errors).length === 0;
  const hrMax = measured ?? (age != null ? tanakaHrMax(age) : null);
  const zones = ok && hrMax != null ? hrZones(hrMax, rest) : [];
  const method = rest != null ? "hrr" : "hrmax";

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Age</span>
          <input
            inputMode="numeric"
            value={v.age}
            onChange={(e) => update("age", e.target.value)}
            placeholder="yrs"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Max HR</span>
          <input
            inputMode="numeric"
            value={v.hrMax}
            onChange={(e) => update("hrMax", e.target.value)}
            placeholder="if known"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Resting HR</span>
          <input
            inputMode="numeric"
            value={v.rest}
            onChange={(e) => update("rest", e.target.value)}
            placeholder="optional"
            className={inputCls}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">
        Measured max HR beats the age estimate. Resting HR: take it on waking,
        before getting up.
      </p>
      {touched &&
        Object.values(errors).map((m) => (
          <p key={m} className="mt-2 text-sm text-brand">
            {m}
          </p>
        ))}

      {zones.length > 0 && hrMax != null && (
        <>
          <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              Max heart rate
            </p>
            <p className="text-3xl font-black">
              {hrMax}{" "}
              <span className="text-base font-bold text-muted">bpm</span>
            </p>
            <p className="text-xs text-muted">
              {measured != null
                ? "Measured"
                : `Estimated: 208 − 0.7 × age (Tanaka 2001). Individuals can be 10+ bpm off this`}
              {rest != null ? ` · resting ${rest} bpm` : ""}
            </p>
          </div>

          <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-widest text-muted">
            Zones ·{" "}
            {method === "hrr" ? "heart-rate reserve (Karvonen)" : "% of max HR"}
          </h2>
          <table className="w-full text-left">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-2 font-semibold">Zone</th>
                <th className="py-2 pr-2 font-semibold">bpm</th>
                <th className="py-2 pr-2 font-semibold">
                  {method === "hrr" ? "%HRR" : "%HRmax"}
                </th>
                <th className="py-2 font-semibold">
                  RPE <span className="normal-case">(6–20)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.zone} className="border-b border-line/60">
                  <td className="py-2.5 pr-2">
                    <span className="font-black">{z.zone}</span>{" "}
                    <span className="text-sm text-muted">{z.name}</span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-2 text-lg font-black">
                    {z.bpm[0] == null
                      ? `< ${z.bpm[1] + 1}`
                      : `${z.bpm[0]}–${z.bpm[1]}`}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-2 text-sm text-muted">
                    {z.pct[0] === 0
                      ? `< ${z.pct[1] + 1}%`
                      : `${z.pct[0]}–${z.pct[1]}%`}
                  </td>
                  <td className="py-2.5 text-sm font-bold">{z.borg}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">
            Intensity bands and RPE from the American College of Sports Medicine
            (Garber et al. 2011). RPE here is Borg&apos;s 6–20 scale.{" "}
            {method === "hrmax" &&
              "Add your resting HR for zones based on heart-rate reserve, which ACSM prefers."}
          </p>
        </>
      )}
    </div>
  );
}
