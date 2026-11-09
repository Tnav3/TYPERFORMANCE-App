// Fight record: Win / Loss / Draw and rounds. Pure functions: unit-tested.

export type FightResult = "win" | "loss" | "draw";
export interface Fight {
  id: string;
  athlete_id: string;
  fought_on: string; // YYYY-MM-DD
  result: FightResult;
  rounds: number;
  created_at: string;
}

export const RESULT_LABEL: Record<FightResult, string> = { win: "Win", loss: "Loss", draw: "Draw" };
export const MAX_ROUNDS = 15;

export interface FightRecord {
  wins: number;
  losses: number;
  draws: number;
  fights: number;
  rounds: number;
  /** wins ÷ fights, whole %, null with no fights */
  winPct: number | null;
}

export function recordOf(fights: Pick<Fight, "result" | "rounds">[]): FightRecord {
  const r = { wins: 0, losses: 0, draws: 0, fights: fights.length, rounds: 0 };
  for (const f of fights) {
    if (f.result === "win") r.wins++;
    else if (f.result === "loss") r.losses++;
    else r.draws++;
    r.rounds += f.rounds;
  }
  return { ...r, winPct: r.fights ? Math.round((r.wins / r.fights) * 100) : null };
}

/** "4-1-0" (wins-losses-draws) */
export const recordString = (r: FightRecord) => `${r.wins}-${r.losses}-${r.draws}`;

/** Record per calendar year, newest year first. */
export function byYear<T extends Pick<Fight, "fought_on" | "result" | "rounds">>(fights: T[]) {
  const years = [...new Set(fights.map((f) => Number(f.fought_on.slice(0, 4))))].sort((a, b) => b - a);
  return years.map((year) => ({ year, ...recordOf(fights.filter((f) => f.fought_on.startsWith(`${year}-`))) }));
}

export function validateFight(i: { date: string; result: string; rounds: number; today: string }) {
  const e: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date)) e.date = "Pick the fight date";
  else if (i.date > i.today) e.date = "Fight date can't be in the future";
  if (!["win", "loss", "draw"].includes(i.result)) e.result = "Pick win, loss or draw";
  if (!Number.isInteger(i.rounds) || i.rounds < 1 || i.rounds > MAX_ROUNDS)
    e.rounds = `Rounds from 1 to ${MAX_ROUNDS}`;
  return e;
}
