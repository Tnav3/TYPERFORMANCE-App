"use client";
import { useActionState, useState, useTransition } from "react";
import { saveCheckin, type CheckinFormState } from "@/app/week/actions";
import { wellnessLabel } from "@/lib/scales";
import { Alert, Button } from "./ui";
import { useClearableErrors } from "@/lib/use-clearable-errors";

export interface ExistingCheckin {
  wellness: number;
  bodyweight_kg: number | string | null;
  niggle: boolean;
  niggle_note: string | null;
  submitted_at: string;
}

export function CheckinForm({
  week,
  existing,
  sessionCount,
  weightClassLimit,
}: {
  week: string;
  existing: ExistingCheckin | null;
  sessionCount: number;
  weightClassLimit: number | null;
}) {
  const [state, action, pending] = useActionState<CheckinFormState, FormData>(
    saveCheckin,
    {},
  );
  const [, startTransition] = useTransition();
  const [wellness, setWellness] = useState<number | null>(
    existing?.wellness ?? null,
  );
  const [niggle, setNiggle] = useState(existing?.niggle ?? false);
  const [bw, setBw] = useState(
    existing?.bodyweight_kg != null
      ? String(Number(existing.bodyweight_kg))
      : "",
  );
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const { err, clear } = useClearableErrors(state, state.errors ?? {});
  const submitted = !!existing || state.saved;

  const bwNum = Number(bw.replace(",", "."));
  const overBy =
    weightClassLimit && bw && Number.isFinite(bwNum)
      ? Math.round((bwNum - weightClassLimit) * 10) / 10
      : null;

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (sessionCount === 0 && !confirmEmpty) {
      setConfirmEmpty(true);
      return;
    }
    const fd = new FormData(ev.currentTarget);
    startTransition(() => action(fd));
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-2xl border border-line bg-surface p-5"
    >
      <h2 className="mb-1 text-lg font-black uppercase">How was your week?</h2>
      <p className="mb-5 text-sm text-muted">
        Takes 20 seconds. Your coach sees this.
      </p>

      {state.message && <Alert>{state.message}</Alert>}
      {state.saved && (
        <Alert tone="ok">
          Week submitted. You can still change it for 4 weeks.
        </Alert>
      )}

      <input type="hidden" name="week_start" value={week} />
      <input type="hidden" name="wellness" value={wellness ?? ""} />
      <input type="hidden" name="niggle" value={niggle ? "yes" : "no"} />

      {/* Wellness 1–10 */}
      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-semibold">Overall wellness</span>
          <span className="text-sm text-muted">
            {wellness ? (
              <>
                <b className="text-text">{wellness}</b> ·{" "}
                {wellnessLabel(wellness)}
              </>
            ) : (
              "Sleep, soreness, stress, mood"
            )}
          </span>
        </div>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={wellness === n}
              onClick={() => {
                setWellness(n);
                clear("wellness");
              }}
              className={`min-h-11 rounded-lg border text-sm font-bold ${
                wellness === n
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface-2 text-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>Awful</span>
          <span>Great</span>
        </div>
        {err("wellness") && (
          <p className="mt-1 text-sm text-brand">{err("wellness")}</p>
        )}
      </div>

      {/* Bodyweight */}
      <label className="mb-5 block">
        <span className="mb-1.5 block text-sm font-semibold">
          Bodyweight (kg) · optional
        </span>
        <input
          name="bodyweight_kg"
          inputMode="decimal"
          value={bw}
          onChange={(ev) => {
            setBw(ev.target.value);
            clear("bodyweight_kg");
          }}
          placeholder="Morning weight, e.g. 72.4"
          className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none"
        />
        {overBy != null && !err("bodyweight_kg") && (
          <span
            className={`mt-1 block text-xs ${overBy > 0 ? "text-warn" : "text-muted"}`}
          >
            {overBy > 0 ? `${overBy} kg over` : `${Math.abs(overBy)} kg under`}{" "}
            your {weightClassLimit} kg limit
          </span>
        )}
        {err("bodyweight_kg") && (
          <span className="mt-1 block text-sm text-brand">
            {err("bodyweight_kg")}
          </span>
        )}
      </label>

      {/* Niggle */}
      <fieldset className="mb-5">
        <legend className="mb-1.5 text-sm font-semibold">
          Any injuries or niggles?
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { v: false, l: "No" },
            { v: true, l: "Yes" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              aria-pressed={niggle === o.v}
              onClick={() => {
                setNiggle(o.v);
                clear("niggle_note");
              }}
              className={`min-h-12 rounded-xl border font-semibold ${
                niggle === o.v
                  ? o.v
                    ? "border-warn bg-warn/15 text-text"
                    : "border-brand bg-brand/15 text-text"
                  : "border-line bg-surface-2 text-muted"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
        {niggle && (
          <textarea
            name="niggle_note"
            onChange={() => clear("niggle_note")}
            defaultValue={existing?.niggle_note ?? ""}
            maxLength={300}
            rows={2}
            placeholder="Where is it, and what does it feel like? e.g. left shin, sore after sparring"
            className="mt-2 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none"
          />
        )}
        {err("niggle_note") && (
          <p className="mt-1 text-sm text-brand">{err("niggle_note")}</p>
        )}
      </fieldset>

      {err("week_start") && <Alert>{err("week_start")}</Alert>}
      {confirmEmpty && sessionCount === 0 && (
        <Alert tone="info">
          No sessions logged this week. Submit anyway (e.g. rest week)? Tap
          submit again.
        </Alert>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : submitted ? "Update week" : "Submit week"}
      </Button>
    </form>
  );
}
