import { loadWidgets } from "@/lib/programming/widgets-data";
import { defaultHomeTrend, trendMessage, type HomeTrend } from "@/lib/programming/widgets";
import { requireState } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { planned } from "@/lib/planned-fights";
import { ClientHome } from "@/components/ClientHome";
import { FightCampCard } from "@/components/FightCampCard";
import { quoteOfDay } from "@/lib/quotes";
import { TeamFeed, type TeamRow } from "@/components/TeamFeed";
import { campStatus, type CampStatus } from "@/lib/fight-camp";
import { clientMenu } from "@/lib/client/menu";
import { statusFor } from "@/components/WorkoutCalendar";
import { welcomeSteps } from "@/lib/tutorial";
import { WelcomeTour } from "@/components/WelcomeTour";
import { formatDate, todayISO } from "@/lib/dates";
import { fightCountdown } from "@/lib/fight";
import { addDays, mondayOf } from "@/lib/week";

export default async function AthleteHome() {
  const { supabase, user, profile } = await requireState(["athlete"]);
  const today = todayISO();
  const thisWeek = mondayOf(today);
  const lastWeek = addDays(thisWeek, -7);

  const [{ data: sessions }, { data: checkins }] =
    await Promise.all([
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
  const programOn = hasFeature(profile, "program");
  const menu = await clientMenu(supabase, profile, user!.id, today);
  const weekEnd = addDays(thisWeek, 6);
  const [{ data: weekRows }, { data: weekLogs }, { data: soon }] = programOn
    ? await Promise.all([
        supabase.rpc("my_workouts", { p_from: thisWeek, p_to: weekEnd }),
        supabase.from("workout_logs").select("workout_id, completed_at").eq("athlete_id", user!.id).gte("workout_date", thisWeek).lte("workout_date", weekEnd),
        supabase.rpc("my_workouts", { p_from: addDays(today, 1), p_to: addDays(today, 21) }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  type W = { id: string; title: string; workout_date: string };
  const week = (weekRows ?? []) as W[];
  const logBy = new Map((weekLogs ?? []).map((l) => [l.workout_id, l]));
  const todayWorkouts = week.filter((w) => w.workout_date === today);
  const next = ((soon ?? []) as W[]).sort((x, y) => x.workout_date.localeCompare(y.workout_date))[0];
  const { data: todayItems } = todayWorkouts.length
    ? await supabase.from("workout_items").select("workout_id, kind, sets, rest_sec").in("workout_id", todayWorkouts.map((w) => w.id))
    : { data: [] };
  const sizeOf = (id: string) => {
    const its = (todayItems ?? []).filter((i) => i.workout_id === id);
    const exercises = its.filter((i) => i.kind === "exercise").length;
    // ~45 s per set plus its rest (90 s if none set), plus 10 min warm-up
    const secs = its.reduce((t, i) => t + (i.sets ?? 0) * (45 + (i.rest_sec ?? 90)), 0);
    return { exercises, mins: exercises ? Math.round((secs + 600) / 300) * 5 : 0 };
  };
  const dayDone = (d: string) => {
    const ws = week.filter((w) => w.workout_date === d);
    if (!ws.length) return "rest" as const;
    const st = ws.map((w) => statusFor(d, today, logBy.get(w.id)));
    return st.every((x) => x === "done") ? ("done" as const) : st.some((x) => x === "missed") ? ("missed" as const) : ("planned" as const);
  };
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(thisWeek, i));
  const doneCount = week.filter((w) => logBy.get(w.id)?.completed_at).length;
  const { count: unreadNotes } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  // Their planned fight date has passed: ask how it went
  const fightToLog = on.fights && profile.next_fight_date && profile.next_fight_date < today;
  const nextFight = plannedFights.find((f) => !f.past);
  const showLastWeek = on.checkin && !prev.submitted && todayISO(new Date(profile.created_at)) < thisWeek;
  const todo: { href: string; title: string; sub: string; tone: "warn" | "brand" | "plain" }[] = [
    ...(menu.formsDue > 0 ? [{ href: "/forms", title: menu.formsDue === 1 ? "Check-in due" : `${menu.formsDue} check-ins due`, sub: "Takes about 2 minutes", tone: "warn" as const }] : []),
    ...(showLastWeek ? [{ href: `/week/${lastWeek}`, title: "Finish last week's check-in", sub: `${prev.count} session${prev.count === 1 ? "" : "s"} logged`, tone: "warn" as const }] : []),
    ...(fightToLog ? [{ href: "/fights#log", title: "How did your fight go?", sub: `${formatDate(profile.next_fight_date!)} · log the result`, tone: "brand" as const }] : []),
    ...(on.checkin && !cur.submitted ? [{ href: `/week/${thisWeek}`, title: "Log this week's training", sub: `${cur.count} session${cur.count === 1 ? "" : "s"} so far`, tone: "plain" as const }] : []),
  ];
  const prefs = profile as unknown as { home_trend: HomeTrend | null; feat_fights: boolean | null; feat_bodyweight: boolean | null; weight_class: string | null; discipline_id: string | null };
  const trendKey = prefs.home_trend ?? defaultHomeTrend({ fighter: prefs.feat_fights !== false && !!(prefs.weight_class || prefs.discipline_id), bodyweight: prefs.feat_bodyweight !== false });
  let trend = null;
  if (programOn && trendKey !== "off") {
    const [w] = await loadWidgets(supabase, user!.id, today, [trendKey], { coach: false });
    if (w && w.points.some((x) => x.value)) {
      const title = w.key === "volume" ? "Volume" : w.title.replace(/ e1RM$/, "");
      trend = {
        title,
        message: trendMessage(title, w.kind, w.points),
        latest: w.latest == null ? "" : `${Math.round(w.latest * 10) / 10}${w.unit === "kg/wk" ? " kg" : ` ${w.unit}`}`,
        kind: w.kind,
        points: w.points,
      };
    }
  }
  const planKey = (profile as unknown as { plan_key: string | null }).plan_key;
  const { data: plan } = planKey
    ? await supabase.from("coaching_plans").select("booking_label, booking_url, cadence, active").eq("key", planKey).maybeSingle()
    : { data: null };
  const booking = plan?.booking_url && plan.active ? { label: plan.booking_label ?? "Book a session", cadence: plan.cadence } : null;
  let weight = null;
  if ((profile as unknown as { feat_bodyweight: boolean | null }).feat_bodyweight !== false) {
    const { data: wts } = await supabase
      .from("body_metrics")
      .select("measured_on, weight_kg")
      .eq("athlete_id", user!.id)
      .not("weight_kg", "is", null)
      .gte("measured_on", addDays(today, -30))
      .order("measured_on", { ascending: false })
      .limit(14);
    const rows = (wts ?? []).map((r) => ({ d: r.measured_on as string, kg: Number(r.weight_kg) }));
    const todayKg = rows.find((r) => r.d === today)?.kg ?? null;
    const prev = rows.find((r) => r.d !== today) ?? null;
    const recent = rows.filter((r) => r.d > addDays(today, -7));
    weight = {
      today: todayKg,
      last: prev ? { kg: prev.kg, label: formatDate(prev.d) } : null,
      week: recent.length >= 3 ? Math.round((recent.reduce((a, r) => a + r.kg, 0) / recent.length) * 10) / 10 : null,
    };
  }
  const limitKg = (profile as unknown as { weight_class_limit_kg: number | null }).weight_class_limit_kg;
  let camp: CampStatus | null = null;
  if (on.fights && profile.next_fight_date) {
    const { data: cw } = await supabase
      .from("body_metrics")
      .select("measured_on, weight_kg")
      .eq("athlete_id", user!.id)
      .not("weight_kg", "is", null)
      .gte("measured_on", addDays(today, -28))
      .order("measured_on");
    camp = campStatus({ fight: profile.next_fight_date, today, limitKg: limitKg == null ? null : Number(limitKg), weights: (cw ?? []).map((r) => ({ date: r.measured_on as string, kg: Number(r.weight_kg) })) });
  }
  const { data: tv } = !profile.tutorial_done_at ? await supabase.from("tour_videos").select("key, url") : { data: null };
  const tourVideos = Object.fromEntries((tv ?? []).map((r) => [r.key, r.url]));
  const { data: teamRows } = await supabase.rpc("group_activity", { p_days: 7 });
  const { data: quoteRows } = await supabase.from("quotes").select("id, body, author").eq("active", true);
  const quote = quoteOfDay(quoteRows ?? [], today);
  return (
    <ClientHome
      quote={quote}
      team={(teamRows ?? []).length ? <TeamFeed rows={teamRows as TeamRow[]} now={Date.now()} /> : null}
      camp={camp ? <FightCampCard s={camp} limitKg={limitKg == null ? null : Number(limitKg)} /> : null}
      weight={weight}
      booking={booking}
      trend={trend}
      tour={!profile.tutorial_done_at ? <WelcomeTour steps={welcomeSteps(profile, tourVideos)} /> : null}
      first={first}
      me={{ name: profile.full_name ?? profile.email, avatar: (profile as unknown as { avatar_path: string | null }).avatar_path ?? null, nickname: (profile as unknown as { nickname: string | null }).nickname ?? null, goal: (profile as unknown as { goal_text: string | null }).goal_text ?? null }}
      fightLabel={nextFight ? nextFight.label.replace(" out", "") : null}
      unreadNotes={unreadNotes ?? 0}
      programOn={programOn}
      today={today}
      todayWorkouts={todayWorkouts.map((w) => ({ id: w.id, title: w.title, done: !!logBy.get(w.id)?.completed_at, ...sizeOf(w.id) }))}
      next={next ? { date: formatDate(next.workout_date), title: next.title } : null}
      todo={todo}
      showTodo={todo.length > 0 || programOn || on.checkin}
      week={programOn && week.length ? { days: weekDays.map((d) => ({ date: d, st: dayDone(d) })), done: doneCount, total: week.length } : null}
      empty={!programOn && !on.checkin && menu.items.length === 0}
      tabs={{ train: programOn, chat: menu.chatOn, progress: programOn, chatBadge: menu.unreadChat, moreBadge: menu.formsDue, food: menu.food }}
    />
  );
}
