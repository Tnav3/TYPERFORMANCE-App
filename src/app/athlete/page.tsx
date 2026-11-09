import Link from "next/link";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { fightCountdown } from "@/lib/fight";
import { addDays, mondayOf } from "@/lib/week";
import { Card, Logo, Screen, SignOutButton } from "@/components/ui";

export default async function AthleteHome() {
  const { supabase, user, profile } = await requireState(["athlete"]);
  const today = todayISO();
  const thisWeek = mondayOf(today);
  const lastWeek = addDays(thisWeek, -7);

  const [{ data: disc }, { data: sessions }, { data: checkins }] =
    await Promise.all([
      profile.main_discipline_id
        ? supabase
            .from("disciplines")
            .select("name")
            .eq("id", profile.main_discipline_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("training_sessions")
        .select("week_start, load_au")
        .eq("athlete_id", user!.id)
        .in("week_start", [thisWeek, lastWeek]),
      supabase
        .from("weekly_checkins")
        .select("week_start")
        .eq("athlete_id", user!.id)
        .in("week_start", [thisWeek, lastWeek]),
    ]);

  const stats = (w: string) => {
    const s = (sessions ?? []).filter((r) => r.week_start === w);
    return {
      count: s.length,
      load: s.reduce((a, r) => a + r.load_au, 0),
      submitted: (checkins ?? []).some((c) => c.week_start === w),
    };
  };
  const cur = stats(thisWeek);
  const prev = stats(lastWeek);
  const fight = fightCountdown(profile.next_fight_date, today);
  const first = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <Screen>
      <header className="mb-6 flex items-center justify-between">
        <Logo size={40} />
        <SignOutButton />
      </header>

      <h1 className="text-2xl font-black uppercase tracking-tight">
        Hey {first}
      </h1>
      <p className="mb-6 text-muted">
        {disc?.name ?? "Athlete"}
        {profile.weight_class
          ? ` · ${profile.weight_class} (${Number(profile.weight_class_limit_kg)} kg)`
          : ""}
      </p>

      {/* Only nag about last week if they had an account before it ended */}
      {!prev.submitted && todayISO(new Date(profile.created_at)) < thisWeek && (
        <Link href={`/week/${lastWeek}`} className="mb-4 block">
          <Card className="border-warn/60 hover:border-warn">
            <p className="text-xs font-semibold uppercase tracking-widest text-warn">
              Last week not submitted
            </p>
            <p className="mt-1 font-extrabold">
              {prev.count} session{prev.count === 1 ? "" : "s"} logged · tap to
              finish your check-in →
            </p>
          </Card>
        </Link>
      )}

      <Link href={`/week/${thisWeek}`} className="mb-4 block">
        <Card className="hover:border-muted">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                This week
              </p>
              <p className="mt-1 text-3xl font-black">{cur.load}</p>
              <p className="text-sm text-muted">
                load · {cur.count} session{cur.count === 1 ? "" : "s"}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${cur.submitted ? "bg-ok/15 text-ok" : "bg-surface-2 text-muted"}`}
            >
              {cur.submitted ? "Submitted" : "Open"}
            </span>
          </div>
          <p className="mt-4 font-extrabold text-brand">Log training →</p>
        </Card>
      </Link>

      {fight && profile.next_fight_date && (
        <Card
          className={`mb-4 ${fight.past ? "border-warn/60" : "border-brand/60"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Next fight
          </p>
          <p className="mt-1 text-3xl font-black">{fight.label}</p>
          <p className="text-sm text-muted">
            {formatDate(profile.next_fight_date)}
          </p>
        </Card>
      )}

      <Link href="/tests" className="mb-4 block">
        <Card className="flex items-center justify-between hover:border-muted">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              Testing
            </p>
            <p className="mt-1 font-extrabold">
              Videos, instructions & your results
            </p>
          </div>
          <span className="text-xl text-muted" aria-hidden>
            →
          </span>
        </Card>
      </Link>

      <Link href="/calculator" className="mb-4 block">
        <Card className="flex items-center justify-between hover:border-muted">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              1RM Calculator
            </p>
            <p className="mt-1 font-extrabold">
              Your e1RM and loads for every %
            </p>
          </div>
          <span className="text-xl text-muted" aria-hidden>
            →
          </span>
        </Card>
      </Link>

      <Link href="/mas" className="mb-4 block">
        <Card className="flex items-center justify-between hover:border-muted">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              MAS Calculator
            </p>
            <p className="mt-1 font-extrabold">
              Interval targets: run, bike, row, SkiErg
            </p>
          </div>
          <span className="text-xl text-muted" aria-hidden>
            →
          </span>
        </Card>
      </Link>

      <Link
        href="/profile"
        className="text-sm text-muted underline underline-offset-4"
      >
        Edit my profile
      </Link>
    </Screen>
  );
}
