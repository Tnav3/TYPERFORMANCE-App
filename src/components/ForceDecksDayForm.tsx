"use client";
import { useActionState, useState, useTransition } from "react";
import { saveForceDecksDay, type EntryState } from "@/app/tests/actions";
import { TEST_FIELDS, dsiFrom, DSI_LABEL } from "@/lib/testing";
import { Alert, Button } from "./ui";

const BATTERY: { key: string; name: string }[] = [
  { key: "cmj", name: "CMJ" },
  { key: "slj", name: "Single leg jump" },
  { key: "sl_iso_squat", name: "SL isometric squat" },
  { key: "imtp", name: "IMTP" },
  { key: "plyo_pushup", name: "Plyo push-up" },
  { key: "rj_10_5", name: "10-5 RJT (always last)" },
];
const inputCls =
  "min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-text focus:border-brand focus:outline-none";

/** One ForceDecks session in battery order. Leave any test blank to skip it. */
export function ForceDecksDayForm({
  athleteId,
  today,
}: {
  athleteId: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<EntryState, FormData>(
    saveForceDecksDay,
    {},
  );
  const [, startTransition] = useTransition();
  const [cmjPf, setCmjPf] = useState("");
  const [imtpPf, setImtpPf] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [dismissed, setDismissed] = useState<EntryState | null>(null);
  const e = state.errors ?? {};
  const dsi = dsiFrom(Number(cmjPf), Number(imtpPf));

  if (state.saved && !pending && dismissed !== state) {
    return (
      <div>
        <Alert tone="ok">ForceDecks session saved.</Alert>
        <Button
          variant="ghost"
          onClick={() => {
            setFormKey((k) => k + 1);
            setDismissed(state);
            setCmjPf("");
            setImtpPf("");
          }}
        >
          Enter another session
        </Button>
      </div>
    );
  }

  return (
    <form
      key={formKey}
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {state.message && <Alert>{state.message}</Alert>}
      {e._ && <Alert>{e._}</Alert>}
      <input type="hidden" name="athlete_id" value={athleteId} />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <label>
          <span className="mb-1 block text-sm font-semibold">Date</span>
          <input
            type="date"
            name="tested_on"
            defaultValue={today}
            max={today}
            className={inputCls}
          />
          {e.tested_on && (
            <span className="text-sm text-brand">{e.tested_on}</span>
          )}
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">
            Bodyweight (kg)
          </span>
          <input
            name="bodyweight_kg"
            inputMode="decimal"
            className={inputCls}
          />
          {e.bodyweight_kg && (
            <span className="text-sm text-brand">{e.bodyweight_kg}</span>
          )}
        </label>
      </div>

      <div className="space-y-3">
        {BATTERY.map((t, i) => (
          <fieldset key={t.key} className="rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-extrabold">
              {i + 1}. {t.name}
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TEST_FIELDS[t.key].map((f) => {
                const name = `${t.key}.${f.key}`;
                const tracked =
                  name === "cmj.peak_force_n"
                    ? setCmjPf
                    : name === "imtp.peak_force_n"
                      ? setImtpPf
                      : null;
                return (
                  <label key={f.key}>
                    <span className="mb-1 block text-xs text-muted">
                      {f.label}
                      {f.unit ? ` (${f.unit})` : ""}
                    </span>
                    <input
                      name={name}
                      inputMode="decimal"
                      onChange={
                        tracked ? (ev) => tracked(ev.target.value) : undefined
                      }
                      className={inputCls}
                    />
                    {e[name] && (
                      <span className="text-xs text-brand">{e[name]}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {dsi && (
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
          DSI <b>{dsi.value}</b> · {DSI_LABEL[dsi.band]}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? "Saving…" : "Save ForceDecks session"}
      </Button>
    </form>
  );
}
