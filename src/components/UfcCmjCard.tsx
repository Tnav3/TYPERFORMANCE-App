"use client";
import { useState } from "react";
import type { Sex } from "@/lib/standards";
import {
  UFC_CMJ_SOURCE,
  UFC_TIERS,
  ufcClassByCode,
  ufcClassesFor,
  ufcNext,
  ufcTier,
} from "@/lib/ufc-cmj";
import { Card } from "./ui";

/** CMJ height against UFC fighters in a chosen division (7 tiers). */
export function UfcCmjCard({
  sex,
  defaultCode,
  value,
}: {
  sex: Sex;
  defaultCode: string | null;
  value: number | null;
}) {
  const classes = ufcClassesFor(sex);
  const [code, setCode] = useState(defaultCode ?? classes[0].code);
  const c = ufcClassByCode(code) ?? classes[0];
  const tier = value != null ? ufcTier(value, c) : null;
  const next = value != null ? ufcNext(value, c) : null;
  const rows = UFC_TIERS.map((t, i) => ({
    tier: t,
    range:
      i === 0
        ? `${c.floors[0].toFixed(1)}+`
        : i < 6
          ? `${c.floors[i].toFixed(1)} – ${(c.floors[i - 1] - 0.1).toFixed(1)}`
          : `< ${c.floors[5].toFixed(1)}`,
  }));

  return (
    <Card className="mb-4">
      <h2 className="text-lg font-black uppercase leading-tight">
        CMJ vs UFC Fighters
      </h2>
      <p className="mb-3 text-xs text-muted">Jump height (cm) by division</p>
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-xs uppercase tracking-widest text-muted">
          Division
        </span>
        <select
          value={c.code}
          onChange={(e) => setCode(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-text focus:border-brand focus:outline-none"
        >
          {classes.map((x) => (
            <option key={x.code} value={x.code}>
              {x.name} ({x.limitKg} kg)
            </option>
          ))}
        </select>
      </label>
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.tier}
              className={`border-t border-line ${r.tier === tier ? "bg-brand/15 font-extrabold" : ""}`}
            >
              <td className="px-2 py-1.5">
                {r.tier}
                {r.tier === tier ? " · you" : ""}
              </td>
              <td className="px-2 py-1.5 text-right">{r.range}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {value == null ? (
        <p className="mt-3 text-sm text-muted">
          Enter a CMJ result to see where you sit.
        </p>
      ) : (
        <p className="mt-3 text-sm">
          You <b>{value.toFixed(1)} cm</b>
          {next ? (
            <>
              {" "}
              · Next: <b>{next.tier}</b> at {next.at.toFixed(1)} cm{" "}
              <span className="text-muted">(+{next.gap.toFixed(1)} to go)</span>
            </>
          ) : (
            " · World Class for this division"
          )}
        </p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted underline underline-offset-4">
          Where these numbers come from
        </summary>
        <p className="mt-1 text-xs text-muted">
          {UFC_CMJ_SOURCE} Measured on force plates, so a jump mat or phone app
          may read differently. Compare like with like.
        </p>
      </details>
    </Card>
  );
}
