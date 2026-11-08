"use client";
import { useActionState, useState, useTransition } from "react";
import { saveProfile, type ProfileFormState } from "@/app/onboarding/actions";
import type { Discipline, Profile } from "@/lib/types";
import { Alert, Button, Field, Input, Select } from "./ui";

export function ProfileForm({
  profile,
  disciplines,
  submitLabel,
  today,
}: {
  profile: Profile;
  disciplines: Discipline[];
  submitLabel: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(
    saveProfile,
    {},
  );
  const [, startTransition] = useTransition();
  const [competing, setCompeting] = useState<boolean>(
    profile.profile_completed_at ? profile.weight_class != null : true,
  );
  const e = state.errors ?? {};

  // Submit manually instead of <form action>: React 19 clears uncontrolled
  // fields after a form action, which would wipe the athlete's typing when
  // validation fails.
  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    startTransition(() => action(fd));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {state.message && <Alert>{state.message}</Alert>}
      {state.saved && <Alert tone="ok">Saved.</Alert>}

      <Field label="Full name" error={e.full_name}>
        <Input
          name="full_name"
          defaultValue={profile.full_name ?? ""}
          autoComplete="name"
        />
      </Field>

      <Field label="Main discipline" error={e.main_discipline_id}>
        <Select
          name="main_discipline_id"
          defaultValue={profile.main_discipline_id ?? ""}
        >
          <option value="" disabled>
            Choose…
          </option>
          {disciplines.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Training age (years)"
        hint="How long you've trained seriously. Halves are fine, e.g. 2.5"
        error={e.training_age_years}
      >
        <Input
          name="training_age_years"
          inputMode="decimal"
          defaultValue={profile.training_age_years?.toString() ?? ""}
          placeholder="e.g. 3"
        />
      </Field>

      <fieldset className="mb-4">
        <legend className="mb-1.5 text-sm font-semibold">
          Do you compete?
        </legend>
        <input
          type="hidden"
          name="competing"
          value={competing ? "yes" : "no"}
        />
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: true, l: "Yes" },
            { v: false, l: "Not right now" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              onClick={() => setCompeting(o.v)}
              aria-pressed={competing === o.v}
              className={`min-h-12 rounded-xl border font-semibold transition ${
                competing === o.v
                  ? "border-brand bg-brand/15 text-text"
                  : "border-line bg-surface-2 text-muted"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </fieldset>

      {competing && (
        <div className="rounded-2xl border border-line p-4 pb-0">
          <Field label="Weight class" error={e.weight_class}>
            <Input
              name="weight_class"
              defaultValue={profile.weight_class ?? ""}
              placeholder="e.g. Lightweight"
            />
          </Field>
          <Field
            label="Weight class limit (kg)"
            error={e.weight_class_limit_kg}
          >
            <Input
              name="weight_class_limit_kg"
              inputMode="decimal"
              defaultValue={profile.weight_class_limit_kg?.toString() ?? ""}
              placeholder="e.g. 70.3"
            />
          </Field>
          <Field
            label="Next fight date"
            hint="Leave blank if not booked yet"
            error={e.next_fight_date}
          >
            <Input
              name="next_fight_date"
              type="date"
              min={today}
              defaultValue={profile.next_fight_date ?? ""}
            />
          </Field>
        </div>
      )}

      <Button type="submit" disabled={pending} className="mt-6">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
