// Player card leaderboard: top rated and monthly movers. Opt-in; opens at 8 people;
// never shows how many people are on it.
import Link from "next/link";
import { requireState } from "@/lib/session";
import { avatarUrl, initials } from "@/lib/avatar";
import { setCardOnBoard } from "@/app/trophies/actions";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

type Row = { rank: number; name: string; avatar: string | null; overall: number; tier: string; gain?: number; me: boolean };
type Board = { open: boolean; me_on: boolean; my_top_pct?: number | null; top?: Row[]; movers?: Row[] } | null;

const TIER_DOT: Record<string, string> = {
  rookie: "from-zinc-400 to-zinc-700",
  bronze: "from-amber-500 to-orange-800",
  silver: "from-slate-200 to-slate-500",
  gold: "from-yellow-200 to-amber-500",
  elite: "from-[#D2141E] to-[#282828]",
};

function Rows({ rows, gain }: { rows: Row[]; gain?: boolean }) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {rows.map((r, i) => {
        const url = avatarUrl(r.avatar);
        return (
          <li key={i} className={`flex min-h-14 items-center gap-3 px-3 py-2 ${r.me ? "bg-brand/10" : ""}`}>
            <span className={`w-6 text-center text-sm font-black ${r.rank <= 3 ? "text-brand" : "text-muted"}`}>{r.rank}</span>
            <span className={`shrink-0 rounded-full bg-gradient-to-br p-[2px] ${TIER_DOT[r.tier] ?? TIER_DOT.rookie}`}>
              {url ? (
                <img src={url} alt="" className="h-9 w-9 rounded-full border-2 border-ink object-cover" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-surface-2 text-xs font-black">{initials(r.name)}</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold">{r.name}{r.me && <span className="ml-1 text-xs font-bold text-brand">(you)</span>}</span>
              <span className="block text-xs capitalize text-muted">{r.tier}</span>
            </span>
            {gain ? (
              <span className="text-right">
                <span className="block text-lg font-black text-ok">+{r.gain}</span>
                <span className="block text-[10px] text-muted">now {r.overall}</span>
              </span>
            ) : (
              <span className="text-xl font-black">{r.overall}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default async function CardLeaderboard({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { supabase, viewAs, state } = await requireState(["athlete", "coach"]);
  const { b: which } = await searchParams;
  const { data } = await supabase.rpc("card_leaderboard");
  const board = data as Board;
  const movers = which === "movers";

  return (
    <Screen>
      <BackLink href={state === "coach" ? "/coach" : "/trophies"} label={state === "coach" ? "Dashboard" : "Trophy cabinet"} />
      <Heading sub="Ratings from player cards. Only people who opt in are shown.">Card leaderboard</Heading>

      {state === "athlete" && !board?.me_on && !viewAs && (
        <form action={setCardOnBoard} className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-brand/50 bg-brand/10 p-3">
          <span className="text-sm font-bold">Your card isn&apos;t on the board.</span>
          <input type="hidden" name="on" value="true" />
          <button className="min-h-10 shrink-0 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">Join</button>
        </form>
      )}

      {!board?.open ? (
        <div className="rounded-2xl border border-line bg-surface p-5 text-center">
          <p className="text-3xl" aria-hidden>🏆</p>
          <p className="mt-2 text-lg font-black uppercase">Opening soon</p>
          <p className="mt-1 text-sm text-muted">The leaderboard opens once enough athletes have joined. {board?.me_on ? "You're in, so you'll be on it from day one." : "Join now to be on it from day one."}</p>
        </div>
      ) : (
        <>
          {board.my_top_pct != null && (
            <div className="mb-4 rounded-2xl border border-line bg-surface p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Your rating</p>
              <p className="text-2xl font-black uppercase text-brand">{board.my_top_pct >= 100 ? "On the board" : `Top ${board.my_top_pct}%`}</p>
              {board.my_top_pct >= 50 && <p className="text-xs text-muted">Finish your sessions and retest to climb.</p>}
            </div>
          )}
          <div className="mb-3 grid grid-cols-2 rounded-xl border border-line p-0.5 text-sm font-bold">
            <Link href="/trophies/leaderboard" className={`min-h-10 rounded-lg py-2 text-center ${!movers ? "bg-text text-ink" : "text-muted"}`}>Top rated</Link>
            <Link href="/trophies/leaderboard?b=movers" className={`min-h-10 rounded-lg py-2 text-center ${movers ? "bg-text text-ink" : "text-muted"}`}>Movers this month</Link>
          </div>
          {movers ? (
            board.movers?.length ? <Rows rows={board.movers} gain /> : <p className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted">No one has moved up yet this month. Be the first.</p>
          ) : (
            <Rows rows={board.top ?? []} />
          )}
        </>
      )}
    </Screen>
  );
}
