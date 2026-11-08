"use client";
import { useState } from "react";

/**
 * Hides a field's error as soon as the user changes that field,
 * until the next submit returns a fresh set of errors.
 */
export function useClearableErrors<S extends object, K extends string>(state: S, errors: Partial<Record<K, string>>) {
  const [cleared, setCleared] = useState<{ for: S; fields: K[] }>({ for: state, fields: [] });
  const fields = cleared.for === state ? cleared.fields : [];
  return {
    err: (k: K) => (fields.includes(k) ? undefined : errors[k]),
    clear: (k: K) => {
      if (!fields.includes(k) && errors[k]) setCleared({ for: state, fields: [...fields, k] });
    },
  };
}
