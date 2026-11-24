import Link from "next/link";
import { requireState } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { planned } from "@/lib/planned-fights";
import { NextFightCard } from "@/components/NextFightCard";
import {
  CircleHelp,
  Bell,
  Camera,
  ClipboardList,
  ClipboardCheck,
  Gift,
  ListChecks,
  MessageCircle,
  Salad,
  Utensils,
  Scale,
  TrendingUp,
  PersonStanding,
  Trophy,
  Wrench,
} from "lucide-react";
import { toolsFor } from "@/lib/tools";
import { welcomeSteps } from "@/lib/tutorial";
import { WelcomeTour } from "@/components/WelcomeTour";
import { formatDate, todayISO } from "@/lib/dates";
import { fightCountdown } from "@/lib/fight";
import { currentDue, type Repeat } from "@/lib/forms";
import { addDays, mondayOf } from "@/lib/week";
import {
  Card,
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
  const programOn = hasFeature(profile, "program");
  const { data: todays } = programOn
    ? await supabase.rpc("my_workouts", { p_from: today, p_to: today })
    : { data: null };
  const todayWorkouts = (todays ?? []) as { id: string; title: string }[];
  const { data: todayLogs } = todayWorkouts.length
    ? await supabase
        .from("workout_logs")
        .select("workout_id, completed_at")
        .eq("athlete_id", user!.id)
        .in("workout_id", todayWorkouts.map((w) => w.id))
    : { data: [] };
  const chatOn = hasFeature(profile, "chat");
  const { count: unreadChat } = chatOn
    ? await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("athlete_id", user!.id)
        .neq("sender_id", user!.id)
        .is("read_at", null)
    : { count: 0 };
  const [{ data: fAsg }, { data: fResp }] = await Promise.all([
    supabase.from("form_assignments").select("id, form_id, repeat, starts_on, forms(archived)").eq("athlete_id", user!.id).eq("active", true),
    supabase.from("form_responses").select("form_id, due_on").eq("athlete_id", user!.id).gte("due_on", addDays(today, -62)),
  ]);
  const formsDue = (fAsg ?? []).filter((a) => {
    if ((a.forms as unknown as { archived: boolean } | null)?.archived) return false;
    const due = currentDue({ repeat: a.repeat as Repeat, starts_on: a.starts_on }, today);
    return !!due && !(fResp ?? []).some((r) => r.form_id === a.form_id && r.due_on === due);
  }).length;
  const { data: offer } = await supabase.from("referral_offers").select("id").eq("active", true).limit(1).maybeSingle();
  const doneIds = new Set((todayLogs ?? []).filter((l) => l.completed_at).map((l) => l.workout_id));
  // Their planned fight date has passed: ask how it went
  const fightToLog =
    on.fights && profile.next_fight_date && profile.next_fight_date < today;

  return (
    <Screen>
      {!profile.tutorial_done_at && (
        <WelcomeTour steps={welcomeSteps(profile)} />
      )}
      <header className="mb-5 flex items-center justify-between">
        <Logo size={40} />
        <Link href="/profile" className="text-sm text-muted underline underline-offset-4">My profile</Link>
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

      {programOn && (
        <Link
          href={todayWorkouts.length === 1 ? `/train/${todayWorkouts[0].id}` : "/train"}
          className="mb-4 block"
        >
          <Card className="border-brand bg-brand/10 hover:border-brand">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              Today&apos;s training
            </p>
            {todayWorkouts.length ? (
              todayWorkouts.map((w) => (
                <p key={w.id} className="mt-1 flex items-center justify-between text-lg font-black uppercase leading-tight tracking-tight">
                  {w.title}
                  {doneIds.has(w.id) && <span className="rounded-full bg-ok/15 px-3 py-1 text-xs font-bold normal-case text-ok">Done</span>}
                </p>
              ))
            ) : (
              <p className="mt-1 text-lg font-black uppercase leading-tight tracking-tight">Rest day</p>
            )}
            <p className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-brand font-extrabold uppercase tracking-wide text-white">
              {todayWorkouts.length && !todayWorkouts.every((w) => doneIds.has(w.id)) ? "Start workout" : "See my program"}
            </p>
          </Card>
        </Link>
      )}

      {formsDue > 0 && (
        <Link href="/forms" className="mb-4 block">
          <Card className="border-warn/60 hover:border-warn">
            <p className="text-xs font-semibold uppercase tracking-widest text-warn">Check-in due</p>
            <p className="mt-1 font-extrabold">Your coach is waiting on {formsDue === 1 ? "a quick check-in" : `${formsDue} check-ins`} · tap to fill in →</p>
          </Card>
        </Link>
      )}

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

      {(() => {
        const tiles: [boolean, string, string, React.ReactNode, number?][] = [
          [chatOn, "/chat", "Chat", <MessageCircle key="c" size={28} />, unreadChat ?? 0],
          [(fAsg ?? []).length > 0, "/forms", "Check-in", <ClipboardCheck key="ci" size={28} />, formsDue],
          [programOn, "/train/history", "Progress", <TrendingUp key="p" size={28} />],
          [hasFeature(profile, "bodyweight"), "/bodyweight", "Weigh-in", <Scale key="b" size={28} />],
          [hasFeature(profile, "habits"), "/habits", "Habits", <ListChecks key="h" size={28} />],
          [hasFeature(profile, "macros"), "/macros", "Macros", <Utensils key="m" size={28} />],
          [hasFeature(profile, "mealplan"), "/meal-plan", "Meal Plan", <Salad key="mp" size={28} />],
          [hasFeature(profile, "photos"), "/photos", "Photos", <Camera key="ph" size={28} />],
          [on.testing, "/tests", "Testing", <ClipboardList key="t" size={28} />],
          [on.mobility, "/mobility", "Mobility", <PersonStanding key="mo" size={28} />],
          [tools.length > 0, "/tools", "Tools", <Wrench key="w" size={28} />],
          [on.fights, "/fights", "My Fights", <Trophy key="f" size={28} />],
          [!!offer, "/refer", "Refer a friend", <Gift key="r" size={28} />],
        ];
        const shown = tiles.filter((t) => t[0]);
        return shown.length ? (
          <nav className="mb-6 mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map(([, href, label, icon, badge]) => (
              <Link
                key={href}
                href={href}
                className="relative flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface-2 text-center transition-colors hover:border-brand active:bg-surface"
              >
                <span className="text-brand">{icon}</span>
                <span className="text-base font-extrabold">{label}</span>
                {badge ? (
                  <span className="absolute right-3 top-3 rounded-full bg-brand px-2 py-0.5 text-xs font-black text-white">{badge}{label === "Chat" ? " new" : " due"}</span>
                ) : null}
              </Link>
            ))}
          </nav>
        ) : !on.checkin && !programOn ? (
          <Card className="mb-4">
            <p className="text-muted">Your coach hasn&apos;t switched on any features for you yet.</p>
          </Card>
        ) : null;
      })()}

      <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-line pt-5 text-sm text-muted">
        <Link href="/notifications" className="inline-flex min-h-11 items-center gap-1.5"><Bell size={16} /> Notifications</Link>
        <Link href="/faq" className="inline-flex min-h-11 items-center gap-1.5"><CircleHelp size={16} /> Help</Link>
        <Link href="/profile" className="inline-flex min-h-11 items-center">My profile</Link>
        <SignOutButton />
      </footer>
    </Screen>
  );
}
