import { Check } from "lucide-react";
import { requireFeature } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import { addDays, dayShort } from "@/lib/week";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { Celebrate } from "@/components/Celebrate";
import { habitStats } from "@/lib/programming/habits";
import { toggleHabit } from "@/app/lifestyle-actions";

export const dynamic = "force-dynamic";

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; perfect?: string; badge?: string }>;
}) {
  const { supabase, user } = await requireFeature(["athlete"], "habits");
  const { error, perfect, badge } = await searchParams;
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from("habits").select("id, name").eq("athlete_id", user!.id).eq("active", true).order("sort_order").order("created_at"),
    supabase.from("habit_logs").select("habit_id, day").eq("athlete_id", user!.id).gte("day", addDays(today, -120)),
  ]);
  const stats = habitStats((habits ?? []).map((h) => h.id), logs ?? [], today);
  const done = new Set((logs ?? []).map((l) => `${l.habit_id}|${l.day}`));
  const todayDone = (habits ?? []).filter((h) => done.has(`${h.id}|${today}`)).length;

  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading sub={(habits ?? []).length ? `${todayDone} of ${(habits ?? []).length} done today` : undefined}>Habits</Heading>
      {error && <Alert>{error}</Alert>}
      {(perfect || badge) && <Celebrate />}
      {perfect && <Alert tone="ok">Perfect day: every habit ticked. 🔥</Alert>}
      {badge && <Alert tone="ok">New badge: {badge} 🏅</Alert>}
      {(habits ?? []).length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface-2 p-2">
            <p className="text-2xl font-black text-brand">🔥 {stats.perfectStreak}</p>
            <p className="text-[11px] text-muted">perfect-day streak</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-2">
            <p className="text-2xl font-black">{stats.weekScore}%</p>
            <p className="text-[11px] text-muted">this week</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-2">
            <p className="text-2xl font-black">{stats.perfectDaysThisWeek}</p>
            <p className="text-[11px] text-muted">perfect days this week</p>
          </div>
        </div>
      )}
      {!(habits ?? []).length && <p className="text-muted">Your coach hasn&apos;t set any habits yet.</p>}
      <div className="space-y-2">
        {(habits ?? []).map((h) => {
          const on = done.has(`${h.id}|${today}`);
          return (
            <Card key={h.id} className="!p-3">
              <form action={toggleHabit} className="flex items-center justify-between gap-3">
                <input type="hidden" name="habit_id" value={h.id} />
                <input type="hidden" name="day" value={today} />
                <input type="hidden" name="done" value={String(on)} />
                <span className="text-lg font-bold">
                  {h.name}
                  {(stats.perHabit.get(h.id) ?? 0) > 1 && (
                    <span className="ml-2 text-sm font-black text-brand">🔥 {stats.perHabit.get(h.id)}</span>
                  )}
                </span>
                <button
                  className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 ${on ? "border-ok bg-ok text-white" : "border-line text-muted"}`}
                  aria-label={on ? `Undo ${h.name}` : `Done: ${h.name}`}
                >
                  <Check size={24} strokeWidth={3} />
                </button>
              </form>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const hit = done.has(`${h.id}|${d}`);
                  return (
                    <form key={d} action={toggleHabit}>
                      <input type="hidden" name="habit_id" value={h.id} />
                      <input type="hidden" name="day" value={d} />
                      <input type="hidden" name="done" value={String(hit)} />
                      <button className={`flex min-h-10 w-full flex-col items-center justify-center rounded-lg text-[10px] ${hit ? "bg-ok/20 text-ok" : "bg-surface-2 text-muted"}`}>
                        {dayShort(d)}
                        <span className="font-bold">{hit ? "✓" : "·"}</span>
                      </button>
                    </form>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}
