"use client";
import { useActionState, useMemo, useState, useTransition } from "react";
import { saveLiftMax, type SaveMaxState } from "@/app/calculator/actions";
import {
  BENCH_THROW_RANGE,
  VELOCITY_META,
  calculate,
  groupLifts,
  percentTable,
  validateCalc,
  type Lift,
} from "@/lib/calculator";
import { formatDate } from "@/lib/dates";
import { Alert, Button } from "./ui";

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

type Saved = { e1rm_kg: number; saved_on: string; bodyweight_kg: number | null };

const toNum = (s: string) => {
  const t = s.trim().replace(",", ".");
  return t === "" ? NaN : Number(t);
};
const kg = (n: number) => `${+n.toFixed(2)} kg`;

export function Calculator({
  lifts,
  saved,
  initialLift,
  defaultBodyweight,
  canSave,
}: {
  lifts: Lift[];
  saved: Record<string, Saved>;
  initialLift: string | null;
  defaultBodyweight: number | null;
  canSave: boolean;
}) {
  const byKey = useMemo(
    () => Object.fromEntries(lifts.map((l) => [l.key, l])),
    [lifts],
  );
  const groups = groupLifts(lifts.filter((l) => l.active));
  const [liftKey, setLiftKey] = useState(
    initialLift && byKey[initialLift] ? initialLift : (groups[0]?.lifts[0]?.key ?? ""),
  );
  const [load, setLoad] = useState("");
  const [reps, setReps] = useState("");
  const [bw, setBw] = useState(defaultBodyweight != null ? String(defaultBodyweight) : "");
  const [bar, setBar] = useState("20");
  const [state, action, pending] = useActionState<SaveMaxState, FormData>(saveLiftMax, {});
  const [, startTransition] = useTransition();
  const [savedFor, setSavedFor] = useState<SaveMaxState | null>(null);

  const lift = byKey[liftKey] as Lift | undefined;
  if (!lift) return <p className="text-muted">No lifts set up yet.</p>;

  const isJump = lift.kind === "jump";
  const parent = isJump && lift.parent_key ? (byKey[lift.parent_key] as Lift | undefined) : undefined;
  const isBw = lift.kind === "bodyweight";

  // ----- what the table is based on -----
  const typed = { kind: lift.kind, load: toNum(load), reps: toNum(reps), bodyweight: isBw ? toNum(bw) : null };
  const touched = load.trim() !== "" || reps.trim() !== "";
  const typedErrors = touched && !isJump ? validateCalc(typed) : {};
  const typedOk = touched && !isJump && Object.keys(typedErrors).length === 0;
  const result = typedOk ? calculate(typed) : null;

  let base: { e1rm: number; label: string; bw: number | null } | null = null;
  if (isJump) {
    const p = parent && saved[parent.key];
    if (p) base = { e1rm: p.e1rm_kg, label: `${parent!.name} e1RM ${kg(p.e1rm_kg)} (saved ${formatDate(p.saved_on)})`, bw: null };
  } else if (result) {
    base = { e1rm: result.e1rm, label: "Estimate from what you entered", bw: isBw ? typed.bodyweight : null };
  } else if (saved[lift.key]) {
    const s = saved[lift.key];
    const savedBw = isBw ? (Number.isFinite(toNum(bw)) && toNum(bw) >= 30 ? toNum(bw) : s.bodyweight_kg) : null;
    base = { e1rm: s.e1rm_kg, label: `Your saved e1RM (${formatDate(s.saved_on)})`, bw: savedBw };
  }

  const barNum = toNum(bar);
  const barOk = Number.isFinite(barNum) && barNum >= 0 && barNum <= 40;
  const rows = base
    ? percentTable({
        e1rm: base.e1rm,
        kind: lift.kind,
        bodyweight: base.bw,
        barWeight: lift.bar_weight_input && barOk ? barNum : null,
        velocityModel: lift.velocity_model,
      })
    : [];
  const vMeta = lift.velocity_model ? VELOCITY_META[lift.velocity_model] : null;
  const justSaved = state.saved && savedFor !== state && state.saved.lift === lift.key;

  function pick(k: string) {
    setLiftKey(k);
    setLoad("");
    setReps("");
    setSavedFor(state);
    const u = new URL(window.location.href);
    u.searchParams.set("lift", k);
    window.history.replaceState(null, "", u);
  }

  function onSave(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    startTransition(() => {
      action(fd);
    });
  }

  return (
    <div>
      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm font-semibold">Lift</span>
        <select
          value={liftKey}
          onChange={(e) => pick(e.target.value)}
          className={`${inputCls} appearance-none`}
        >
          {groups.map((g) => (
            <optgroup key={g.category} label={g.label}>
              {g.lifts.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.name}
                  {l.per_leg ? " (per leg)" : ""}
                  {saved[l.key] ? ` · ${kg(saved[l.key].e1rm_kg)}` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {isJump ? (
        <div className="mb-4">
          <p className="mb-3 text-sm text-muted">
            No 1RM of its own. Loads are a % of your{" "}
            <strong className="text-text">{parent?.name ?? "parent lift"}</strong> e1RM.
            {lift.parent_key === "bench"
              ? ` Typical range ${BENCH_THROW_RANGE[0]}–${BENCH_THROW_RANGE[1]}% (shaded).`
              : " Use the % your coach prescribes."}
          </p>
          {!base && parent && (
            <Alert tone="info">
              No saved {parent.name} e1RM yet.{" "}
              <button
                type="button"
                onClick={() => pick(parent.key)}
                className="font-bold underline underline-offset-4"
              >
                Work it out first →
              </button>
            </Alert>
          )}
          {lift.bar_weight_input && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">
                Your Smith bar weight <span className="font-normal text-muted">(kg)</span>
              </span>
              <input
                inputMode="decimal"
                value={bar}
                onChange={(e) => setBar(e.target.value)}
                className={inputCls}
              />
              <span className="mt-1 block text-xs text-muted">
                Smith bars vary and some are counterbalanced. Check the label on yours.
              </span>
              {!barOk && <span className="mt-1 block text-sm text-brand">Bar weight from 0 to 40 kg</span>}
            </label>
          )}
        </div>
      ) : (
        <form onSubmit={onSave} noValidate className="mb-4">
          <input type="hidden" name="lift_key" value={lift.key} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">
                {isBw ? "Added weight" : "Weight"} <span className="font-normal text-muted">(kg)</span>
              </span>
              <input
                name="load_kg"
                inputMode="decimal"
                value={load}
                placeholder={isBw ? "0 if none" : ""}
                onChange={(e) => {
                  setLoad(e.target.value);
                  setSavedFor(state);
                }}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">
                Reps <span className="font-normal text-muted">(1–10)</span>
              </span>
              <input
                name="reps"
                inputMode="numeric"
                value={reps}
                onChange={(e) => {
                  setReps(e.target.value);
                  setSavedFor(state);
                }}
                className={inputCls}
              />
            </label>
          </div>
          {isBw && (
            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm font-semibold">
                Bodyweight <span className="font-normal text-muted">(kg)</span>
              </span>
              <input
                name="bodyweight_kg"
                inputMode="decimal"
                value={bw}
                onChange={(e) => {
                  setBw(e.target.value);
                  setSavedFor(state);
                }}
                className={inputCls}
              />
            </label>
          )}
          {touched &&
            Object.values(typedErrors).map((m) => (
              <p key={m} className="mt-2 text-sm text-brand">{m}</p>
            ))}
          {lift.kind === "olympic" && !touched && (
            <p className="mt-2 text-xs text-muted">Olympic lifts: enter a 1–3 rep max.</p>
          )}

          {result && (
            <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                Estimated 1RM{lift.per_leg ? " (per leg)" : ""}
              </p>
              <p className="text-3xl font-black">
                {kg(result.e1rm)}
                {isBw && <span className="ml-1 text-sm font-normal text-muted">bodyweight + added</span>}
              </p>
              {isBw && result.addedMax != null && (
                <p className="text-sm text-muted">
                  Max added load ≈ <strong className="text-text">{kg(result.addedMax)}</strong>
                </p>
              )}
              {toNum(reps) === 1 && <p className="text-sm text-muted">1 rep entered, so this is your actual 1RM.</p>}
              {result.warnings.map((w) => (
                <p key={w} className="mt-2 text-sm text-warn">{w}</p>
              ))}
              {canSave && (
                <div className="mt-3">
                  {state.message && savedFor !== state && <Alert>{state.message}</Alert>}
                  {justSaved ? (
                    <p className="text-sm font-bold text-ok">Saved to your profile ✓</p>
                  ) : (
                    <Button disabled={pending}>{pending ? "Saving…" : "Save this e1RM"}</Button>
                  )}
                </div>
              )}
            </div>
          )}
        </form>
      )}

      {base && (
        <section aria-label="Percentage chart">
          <p className="mb-2 text-sm text-muted">{base.label}. All loads are estimates, rounded to 2.5 kg.</p>
          <table className="w-full text-left">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-2 font-semibold">%</th>
                <th className="py-2 pr-2 font-semibold">{isBw ? "Added" : "Load"}</th>
                {lift.bar_weight_input && <th className="py-2 pr-2 font-semibold">Plates / side</th>}
                {vMeta && (
                  <th className="py-2 font-semibold">
                    Speed guide <span className="normal-case">({vMeta.measure}, m/s)</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inRange =
                  lift.parent_key === "bench" && isJump && r.pct >= BENCH_THROW_RANGE[0] && r.pct <= BENCH_THROW_RANGE[1];
                return (
                  <tr key={r.pct} className={`border-b border-line/60 ${inRange ? "bg-surface-2" : ""}`}>
                    <td className="py-2.5 pr-2 font-bold">{r.pct}%</td>
                    <td className="py-2.5 pr-2 text-lg font-black">
                      {isBw ? (r.added! <= 0 ? <span className="text-base font-bold text-muted">Bodyweight</span> : `+${kg(r.added!)}`) : kg(r.load)}
                    </td>
                    {lift.bar_weight_input && (
                      <td className="py-2.5 pr-2">{r.load < (barOk ? barNum : 0) ? <span className="text-muted">Bar only</span> : kg(r.perSide ?? 0)}</td>
                    )}
                    {vMeta && <td className="py-2.5 text-muted">{r.velocity != null ? `~${r.velocity.toFixed(2)}` : "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {vMeta && (
            <p className="mt-3 text-xs text-muted">
              Speed guide: group averages from research, not your personal target ({vMeta.source}). Move the bar as fast as
              you can every rep.
              {vMeta.measure === "MPV" &&
                " The Metric VBT app shows mean velocity, which reads a little lower than this at light loads."}
              {lift.velocity_model === "squat" && " Only the values confirmed in the research are shown."}
            </p>
          )}
          {isBw && (
            <p className="mt-3 text-xs text-muted">
              % is of bodyweight + added load. &ldquo;Bodyweight&rdquo; means no added weight at that %.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
