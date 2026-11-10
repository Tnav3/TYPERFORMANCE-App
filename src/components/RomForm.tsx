"use client";
import { useActionState, useState, useTransition } from "react";
import { saveRom, type RomState } from "@/app/mobility/actions";
import { REGIONS, unitLabel, type RomMeasure } from "@/lib/mobility";
import { Alert, Button } from "./ui";

const inputCls =
  "min-h-12 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-center text-text focus:border-brand focus:outline-none";

/** Enter range-of-motion results: L/R boxes for sided measures, one box otherwise. */
export function RomForm({
  measures,
  athleteId,
  scope,
  today,
}: {
  measures: RomMeasure[];
  athleteId?: string;
  scope: "self" | "all";
  today: string;
}) {
  const [state, action, pending] = useActionState<RomState, FormData>(
    saveRom,
    {},
  );
  const [, startTransition] = useTransition();
  const [shown, setShown] = useState<RomState | null>(null);
  const [formKey, setFormKey] = useState(0);
  const live = shown === state ? {} : state;
  const err = (k: string) => live.errors?.[k];

  if (live.saved)
    return (
      <div>
        <Alert tone="ok">
          Saved {live.saved} result{live.saved === 1 ? "" : "s"}.
        </Alert>
        <button
          type="button"
          onClick={() => {
            setShown(state);
            setFormKey((k) => k + 1);
          }}
          className="min-h-12 w-full rounded-xl border border-line bg-surface-2 text-sm font-extrabold uppercase tracking-wide"
        >
          Enter more
        </button>
      </div>
    );

  const groups = REGIONS.map((r) => ({
    ...r,
    items: measures.filter((m) => m.region === r.key),
  })).filter((g) => g.items.length);

  return (
    <form
      key={formKey}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {live.message && <Alert>{live.message}</Alert>}
      {athleteId && <input type="hidden" name="athlete_id" value={athleteId} />}
      <input type="hidden" name="scope" value={scope} />

      <label className="mb-5 block">
        <span className="mb-1.5 block text-sm font-semibold">Date</span>
        <input
          type="date"
          name="measured_on"
          defaultValue={today}
          max={today}
          className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text focus:border-brand focus:outline-none"
        />
        {err("measured_on") && (
          <span className="mt-1 block text-sm text-brand">
            {err("measured_on")}
          </span>
        )}
      </label>

      <p className="mb-4 text-sm text-muted">
        Fill in only what you measured. Leave the rest blank.
      </p>

      {groups.map((g) => (
        <fieldset key={g.key} className="mb-5">
          {scope === "all" && (
            <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
              {g.title}
            </legend>
          )}
          {g.items.map((m) => (
            <div key={m.key} className="mb-4">
              <p className="mb-1.5 text-sm font-semibold">
                {m.name}{" "}
                <span className="font-normal text-muted">
                  ({m.unit === "deg" ? "degrees" : "cm"}
                  {m.norm_text ? ` · norm ${m.norm_text}` : ""})
                </span>
              </p>
              {m.instructions && (
                <details className="mb-2 rounded-xl border border-line bg-surface px-3 py-2">
                  <summary className="cursor-pointer text-sm font-bold">
                    How to do it
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                    {m.instructions}
                  </p>
                </details>
              )}
              {m.sided ? (
                <div className="grid grid-cols-2 gap-2">
                  {(["l", "r"] as const).map((s) => (
                    <label key={s} className="block">
                      <span className="mb-1 block text-xs text-muted">
                        {s === "l" ? "Left" : "Right"}
                        {unitLabel(m).trim() ? ` (${unitLabel(m).trim()})` : ""}
                      </span>
                      <input
                        name={`${m.key}_${s}`}
                        inputMode="decimal"
                        aria-label={`${m.name} ${s === "l" ? "left" : "right"}`}
                        className={inputCls}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  name={m.key}
                  inputMode="decimal"
                  aria-label={m.name}
                  className={inputCls}
                />
              )}
              {err(m.key) && (
                <p className="mt-1 text-sm text-brand">{err(m.key)}</p>
              )}
            </div>
          ))}
        </fieldset>
      ))}
      {err("_") && <Alert>{err("_")}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save results"}
      </Button>
    </form>
  );
}
