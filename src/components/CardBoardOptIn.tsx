// Trophy cabinet: join/leave the player card leaderboard, and a link to it.
import Link from "next/link";
import { setCardOnBoard } from "@/app/trophies/actions";

export function CardBoardOptIn({ on, readOnly }: { on: boolean; readOnly?: boolean }) {
  return (
    <div className="mx-auto mb-4 max-w-sm rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-extrabold">Card leaderboard</p>
          <p className="text-xs text-muted">{on ? "Your card is on the board." : "See how your card stacks up. Only your first name and card show."}</p>
        </div>
        <form action={setCardOnBoard}>
          <input type="hidden" name="on" value={String(!on)} />
          <button
            role="switch"
            aria-checked={on}
            aria-label={on ? "Take my card off the leaderboard" : "Put my card on the leaderboard"}
            disabled={readOnly}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-ok" : "bg-surface-2 ring-1 ring-line"}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${on ? "left-7" : "left-1"}`} />
          </button>
        </form>
      </div>
      <Link href="/trophies/leaderboard" className="mt-3 block text-sm font-bold text-brand">See the leaderboard →</Link>
    </div>
  );
}
