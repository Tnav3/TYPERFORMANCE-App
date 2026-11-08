"use client";
import { useState } from "react";
import type { DayTotals } from "@/lib/load-metrics";
import { LoadChart, type LoadChartWeek } from "./LoadChart";
import { DailyLoadChart } from "./DailyLoadChart";

/** Weekly chart on top; tapping a week shows that week's 7-day breakdown underneath. */
export function CoachLoadCharts({
  weeks,
  daily,
  disciplines,
  today,
}: {
  weeks: LoadChartWeek[];
  daily: Record<string, DayTotals[]>; // week_start → 7 days
  disciplines: { id: string; name: string; color: string }[];
  today: string;
}) {
  const lastDone = weeks.map((w) => !w.inProgress).lastIndexOf(true);
  const [active, setActive] = useState(
    lastDone >= 0 ? lastDone : weeks.length - 1,
  );
  const wk = weeks[active];

  return (
    <>
      <LoadChart
        weeks={weeks}
        disciplines={disciplines}
        onActiveChange={setActive}
      />
      {wk && daily[wk.week] && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            7-day view · week of {wk.label}
          </h3>
          {/* key forces a fresh day selection when the week changes */}
          <DailyLoadChart
            key={wk.week}
            days={daily[wk.week]}
            disciplines={disciplines}
            today={today}
          />
        </div>
      )}
    </>
  );
}
