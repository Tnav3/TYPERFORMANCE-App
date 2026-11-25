// End-of-workout: what this session did to the player card.
import Link from "next/link";
import { STAT_LABEL, STAT_NAME, type CardStat } from "@/lib/player-card";
import type { CardSnap } from "@/lib/player-card-data";

const ORDER: CardStat[] = ["str", "pwr", "eng", "con", "grt"];
const TIER_LABEL = { rookie: "Rookie", bronze: "Bronze", silver: "Silver", gold: "Gold", elite: "Elite" } as const;

export function CardChange({ before, after }: { before: CardSnap | null; after: CardSnap }) {
  const deltas = ORDER.map((k) => ({ k, from: before?.stats?.[k] ?? null, to: after.stats[k] }))
    .filter((d) => d.to != null && d.to !== d.from);
  const oFrom = before?.overall ?? null;
  const up = after.overall != null && oFrom != null && after.overall > oFrom;
  const down = after.overall != null && oFrom != null && after.overall < oFrom;
  const tierUp = before && before.tier !== after.tier && up;
  return (
    <Link href="/trophies" className={`mb-4 block rounded-2xl border p-4 ${up ? "border-brand bg-brand/10" : "border-line bg-surface"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Player card</p>
          <p className="font-black uppercase leading-tight">
            {tierUp ? `Promoted to ${TIER_LABEL[after.tier]}!` : up ? "Your card went up" : down ? "Small dip this time" : after.overall == null ? "Card building" : "Card holds steady"}
          </p>
        </div>
        <p className="shrink-0 text-right">
          {oFrom != null && oFrom !== after.overall && <span className="mr-1 text-lg font-bold text-muted line-through">{oFrom}</span>}
          <span className={`text-3xl font-black ${up ? "text-brand" : ""}`}>{after.overall ?? "–"}</span>
          <span className="ml-1 text-xs font-bold text-muted">OVR</span>
        </p>
      </div>
      {deltas.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {deltas.map((d) => {
            const diff = d.from == null ? null : (d.to as number) - d.from;
            return (
              <span key={d.k} title={STAT_NAME[d.k]} className={`rounded-full px-2.5 py-1 text-xs font-black ${diff == null || diff > 0 ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"}`}>
                {STAT_LABEL[d.k]} {d.to}
                {diff == null ? " · new" : ` (${diff > 0 ? "+" : ""}${diff})`}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          {after.overall == null
            ? "Test two qualities with your coach to unlock your rating."
            : "No change this session. Finishing planned sessions lifts CON, and streaks and PBs lift GRT."}
        </p>
      )}
    </Link>
  );
}
