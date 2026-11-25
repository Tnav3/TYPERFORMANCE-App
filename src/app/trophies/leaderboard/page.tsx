// Player card leaderboard: top rated and monthly movers. Opt-in; opens at 8 people;
// never shows how many people are on it.
import Link from "next/link";
import { requireState } from "@/lib/session";
import { setCardOnBoard } from "@/app/trophies/actions";
import { BoardView, type Board } from "@/components/CardBoard";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

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

      <BoardView board={board} movers={movers} />
    </Screen>
  );
}
