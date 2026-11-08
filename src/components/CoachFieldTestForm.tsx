"use client";
import { useState } from "react";
import { TestEntryForm } from "./TestEntryForm";

/** Coach enters a field test for an athlete (e.g. tested in person). */
export function CoachFieldTestForm({
  athleteId,
  today,
  tests,
  defaultBodyweight,
}: {
  athleteId: string;
  today: string;
  tests: { key: string; name: string }[];
  defaultBodyweight: number | null;
}) {
  const [key, setKey] = useState(tests[0]?.key ?? "");
  return (
    <div>
      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm font-semibold">Test</span>
        <select
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-text focus:border-brand focus:outline-none"
        >
          {tests.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {key && (
        <TestEntryForm
          key={key}
          testKey={key}
          athleteId={athleteId}
          today={today}
          defaultBodyweight={defaultBodyweight}
          allowVideo={false}
        />
      )}
    </div>
  );
}
