// Trading-card style player card. Photo in the middle, ratings that grow with training.
// Original design in TYPERFORMANCE colours; no third-party card branding.
import { avatarUrl, initials } from "@/lib/avatar";
import { STAT_LABEL, STAT_NAME, type Card, type CardStat } from "@/lib/player-card";

const TIER: Record<Card["tier"], { label: string; frame: string; glow: string; text: string }> = {
  rookie: { label: "Rookie", frame: "from-zinc-500 via-zinc-700 to-zinc-900", glow: "shadow-zinc-500/20", text: "text-zinc-100" },
  bronze: { label: "Bronze", frame: "from-amber-600 via-orange-800 to-stone-900", glow: "shadow-amber-700/30", text: "text-amber-50" },
  silver: { label: "Silver", frame: "from-slate-200 via-slate-400 to-slate-700", glow: "shadow-slate-300/30", text: "text-slate-50" },
  gold: { label: "Gold", frame: "from-yellow-200 via-amber-400 to-yellow-700", glow: "shadow-amber-400/40", text: "text-yellow-50" },
  elite: { label: "Elite", frame: "from-[#D2141E] via-[#7a0b12] to-[#282828]", glow: "shadow-[#D2141E]/40", text: "text-white" },
};
const ORDER: CardStat[] = ["str", "pwr", "eng", "con", "grt"];

export function PlayerCard({
  card,
  name,
  nickname,
  avatarPath,
  tagline,
  record,
  trophies,
}: {
  card: Card;
  name: string;
  nickname?: string | null;
  avatarPath?: string | null;
  tagline?: string | null; // discipline · weight class
  record?: string | null; // "7-2-0"
  trophies: number;
}) {
  const t = TIER[card.tier];
  const url = avatarUrl(avatarPath);
  return (
    <figure className={`relative mx-auto aspect-[5/7] w-full max-w-[300px] rounded-[22px] bg-gradient-to-br p-[6px] shadow-2xl ${t.frame} ${t.glow}`} aria-label={`Player card for ${name}`}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[17px] bg-[#141414]">
        {/* header: overall + tier */}
        <div className="relative z-10 flex items-start justify-between px-4 pt-3">
          <div className="leading-none">
            <p className={`text-4xl font-black ${t.text}`}>{card.overall ?? "–"}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60">Overall</p>
          </div>
          <span className={`rounded-full bg-gradient-to-r px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${card.tier === "elite" ? "text-white" : "text-black"} ${t.frame}`}>{t.label}</span>
        </div>
        {/* photo */}
        <div className="relative mx-auto mt-1 aspect-square w-[62%]">
          <div className={`absolute inset-0 rounded-full bg-gradient-to-br opacity-70 blur-md ${t.frame}`} />
          {url ? (
            <img src={url} alt="" className="relative h-full w-full rounded-full border-4 border-[#141414] object-cover" />
          ) : (
            <div className="relative flex h-full w-full items-center justify-center rounded-full border-4 border-[#141414] bg-[#282828] text-5xl font-black text-white/80">{initials(name)}</div>
          )}
        </div>
        {/* name */}
        <div className="mt-2 px-3 text-center">
          <p className="truncate text-lg font-black uppercase tracking-wide text-white">{name}</p>
          {nickname && <p className="-mt-0.5 truncate text-xs font-bold italic text-[#D2141E]">&ldquo;{nickname}&rdquo;</p>}
          {tagline && <p className="truncate text-[11px] text-white/50">{tagline}</p>}
        </div>
        {/* stats */}
        <div className="mx-3 mt-auto grid grid-cols-5 gap-1 border-t border-white/10 pt-2">
          {ORDER.map((k) => (
            <div key={k} className="text-center" title={STAT_NAME[k]}>
              <p className="text-lg font-black leading-none text-white">{card.stats[k] ?? "–"}</p>
              <p className="mt-0.5 text-[9px] font-bold tracking-widest text-white/50">{STAT_LABEL[k]}</p>
            </div>
          ))}
        </div>
        {/* footer */}
        <div className="flex items-center justify-between px-4 pb-3 pt-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
          <span>{record ? `Record ${record}` : "TYPERFORMANCE"}</span>
          <span>🏆 {trophies}</span>
        </div>
      </div>
    </figure>
  );
}
