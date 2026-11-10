import Link from "next/link";
import { requireState } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { planned } from "@/lib/planned-fights";
import { NextFightCard } from "@/components/NextFightCard";
import {
  CircleHelp,
  ClipboardList,
  PersonStanding,
  Trophy,
  Wrench,
} from "lucide-react";
import { toolsFor, toolsSummary } from "@/lib/tools";
import { formatDate, todayISO } from "@/lib/dates";
import { fightCountdown } from "@/lib/fight";
import { addDays, mondayOf } from "@/lib/week";
import {
  Card,
  FeatureLink,
  Logo,
  Screen,
  SignOutButton,
} from "@/components/ui";

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
  const plannedFights = planned(profile).map((date) => {
    const c = fightCountdown(date, today)!;
    return {
      date,
      label: c.past ? "Fight done: log the result" : c.label,
      dateLabel: formatDate(date),
      past: c.past,
    };
  });
  const first = profile.full_name?.split(" ")[0] ?? "there";
  const on = {
    checkin: hasFeature(profile, "checkin"),
    testing: hasFeature(profile, "testing"),
    rm: hasFeature(profile, "1rm"),
    mas: hasFeature(profile, "mas"),
    rpe: hasFeature(profile, "rpe"),
    hr: hasFeature(profile, "hr"),
    fights: hasFeature(profile, "fights"),
    mobility: hasFeature(profile, "mobility"),
  };
  const tools = toolsFor(profile);
  // Their planned fight date has passed: ask how it went
  const fightToLog =
    on.fights && profile.next_fight_date && profile.next_fight_date < today;

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
      {on.checkin &&
        !prev.submitted &&
        todayISO(new Date(profile.created_at)) < thisWeek && (
          <Link href={`/week/${lastWeek}`} className="mb-4 block">
            <Card className="border-warn/60 hover:border-warn">
              <p className="text-xs font-semibold uppercase tracking-widest text-warn">
                Last week not submitted
              </p>
              <p className="mt-1 font-extrabold">
                {prev.count} session{prev.count === 1 ? "" : "s"} logged · tap
                to finish your check-in →
              </p>
            </Card>
          </Link>
        )}

      {fightToLog && (
        <Link href="/fights#log" className="mb-4 block">
          <Card className="border-brand/60 hover:border-brand">
            <p className="text-lg font-black uppercase leading-tight tracking-tight">
              How did your fight go?
            </p>
            <p className="mt-1 text-sm text-muted">
              {formatDate(profile.next_fight_date!)} · tap to log the result →
            </p>
          </Card>
        </Link>
      )}

      {on.checkin && (
        <Link href={`/week/${thisWeek}`} className="mb-4 block">
          <Card className="hover:border-muted">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-black uppercase leading-tight tracking-tight">
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
      )}

      {(on.fights || plannedFights.length > 0) && (
        <NextFightCard fights={plannedFights} today={today} />
      )}

      {on.testing && (
        <FeatureLink
          href="/tests"
          title="Testing"
          description="Videos, instructions & your results"
          icon={<ClipboardList size={22} strokeWidth={2.25} />}
        />
      )}

      {on.mobility && (
        <FeatureLink
          href="/mobility"
          title="Mobility"
          description="Your range of motion vs healthy norms"
          icon={<PersonStanding size={22} strokeWidth={2.25} />}
        />
      )}

      {tools.length > 0 && (
        <FeatureLink
          href="/tools"
          title="Training Tools"
          description={toolsSummary(tools)}
          icon={<Wrench size={22} strokeWidth={2.25} />}
        />
      )}

      {on.fights && (
        <FeatureLink
          href="/fights"
          title="Competition Tracker"
          description="Log your fights and track them year by year"
          icon={<Trophy size={22} strokeWidth={2.25} />}
        />
      )}

      {!on.checkin &&
        !on.testing &&
        tools.length === 0 &&
        !on.fights &&
        !on.mobility && (
          <Card className="mb-4">
            <p className="text-muted">
              Your coach hasn&apos;t switched on any features for you yet.
            </p>
          </Card>
        )}

      <FeatureLink
        href="/faq"
        title="FAQ"
        description="Training, niggles and food: quick answers"
        icon={<CircleHelp size={22} strokeWidth={2.25} />}
      />

      <Link
        href="/profile"
        className="text-sm text-muted underline underline-offset-4"
      >
        Edit my profile
      </Link>
    </Screen>
  );
}
