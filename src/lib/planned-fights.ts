// Up to two planned fights per athlete, stored as profiles.next_fight_date and
// profiles.second_fight_date (always sorted: next < second). Pure functions: unit-tested.

export const MAX_PLANNED = 2;

type Cols = { next_fight_date: string | null; second_fight_date: string | null };

export function planned(p: Partial<Cols>): string[] {
  return [p.next_fight_date, p.second_fight_date].filter((d): d is string => !!d).sort();
}

export function toColumns(dates: (string | null | undefined)[]): Cols {
  const d = [...new Set(dates.filter((x): x is string => !!x))].sort().slice(0, MAX_PLANNED);
  return { next_fight_date: d[0] ?? null, second_fight_date: d[1] ?? null };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (iso: string, n: number) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export function addPlanned(current: Partial<Cols>, date: string, today: string): Cols | { error: string } {
  const list = planned(current);
  if (!ISO.test(date)) return { error: "Pick a date" };
  if (date < today) return { error: "That date has passed" };
  if (date > addDays(today, 730)) return { error: "More than 2 years away" };
  if (list.includes(date)) return { error: "That fight is already in" };
  if (list.length >= MAX_PLANNED)
    return { error: list[0] < today ? "Log your last fight's result first, then add the next one." : "You already have 2 fights planned. Remove one first." };
  return toColumns([...list, date]);
}

export function removePlanned(current: Partial<Cols>, date: string): Cols {
  return toColumns(planned(current).filter((d) => d !== date));
}

/** After a fight on `foughtOn` is logged, drop planned dates on or before it. */
export function afterLogged(current: Partial<Cols>, foughtOn: string): Cols {
  return toColumns(planned(current).filter((d) => d > foughtOn));
}
