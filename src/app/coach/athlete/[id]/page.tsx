import { PopoverCloser } from "@/components/PopoverCloser";
import { BellRing, PersonStanding, SlidersHorizontal, Swords, UserPen } from "lucide-react";
import { ClientTabs } from "@/components/ClientTabs";
import { FightCampCard } from "@/components/FightCampCard";
import { campStatus } from "@/lib/fight-camp";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { addFollowUp, clearFollowUp } from "@/app/coach/overview-actions";
import { formatDate, todayISO } from "@/lib/dates";
import { fightCountdown } from "@/lib/fight";
import { addDays, dayMonth, formatTime, mondayOf, weekDays } from "@/lib/week";
import { getCatalog, catalogNames } from "@/lib/catalog";
import { disciplineColors } from "@/lib/colors";
import {
  dailyTotals,
  emptyWeek,
  formatChange,
  trafficLight,
  weeklyTotals,
  type SessionLite,
} from "@/lib/load-metrics";
import { RPE_LABELS, wellnessLabel } from "@/lib/scales";
import type { Profile } from "@/lib/types";
import { Card, Screen } from "@/components/ui";
import { TrafficLight } from "@/components/TrafficLight";
import { type LoadChartWeek } from "@/components/LoadChart";
import { CoachLoadCharts } from "@/components/CoachLoadCharts";
import { WeightChart } from "@/components/WeightChart";
import { CoachNoteForm } from "@/components/CoachNoteForm";
import { setAthleteFeature, setAthleteStatus } from "../../actions";
import { FEATURES } from "@/lib/features";
import { ClientWidgets } from "@/components/ClientWidgets";
import { loadWidgets } from "@/lib/programming/widgets-data";
import { defaultHomeTrend, defaultWidgets, type HomeTrend, type WidgetKey } from "@/lib/programming/widgets";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WEEKS = 12;

interface SessionRow extends SessionLite {
  id: string;
  session_date: string;
  start_time: string;
  rpe: number;
  notes: string | null;
}

export default async function AthleteDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const { data: followUps } = await supabase
    .from("follow_ups")
    .select("id, due_on, note")
    .eq("athlete_id", id)
    .is("done_at", null)
    .order("due_on");
  const { error: pageError } = await searchParams;
  if (!UUID.test(id)) notFound();
  const today = todayISO();
  const thisWeek = mondayOf(today);
  const first = addDays(thisWeek, -7 * (WEEKS - 1));
  const weekList = Array.from({ length: WEEKS }, (_, i) =>
    addDays(first, 7 * i),
  );

  const [
    { data: profile },
    catalog,
    { data: sessions },
    { data: checkins },
    { data: notes },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, discipline:disciplines(name)")
      .eq("id", id)
      .eq("role", "athlete")
      .maybeSingle(),
    getCatalog(supabase),
    supabase
      .from("training_sessions")
      .select(
        "id, athlete_id, week_start, session_date, start_time, discipline_id, session_type_id, duration_min, rpe, load_au, notes",
      )
      .eq("athlete_id", id)
      .gte("week_start", addDays(first, -7)) // one extra week for the first week's change %
      .order("session_date")
      .order("start_time"),
    supabase
      .from("weekly_checkins")
      .select(
        "week_start, wellness, bodyweight_kg, niggle, niggle_note, submitted_at",
      )
      .eq("athlete_id", id)
      .gte("week_start", first),
    supabase
      .from("coach_notes")
      .select("week_start, note, visible_to_athlete")
      .eq("athlete_id", id)
      .gte("week_start", first),
  ]);
  if (!profile) notFound();
  const p = profile as Profile & { discipline: { name: string } | null };

  const rows = (sessions ?? []) as SessionRow[];
  const totals = weeklyTotals(rows).get(id) ?? new Map();
  const wk = (w: string) => totals.get(w) ?? emptyWeek();
  const ck = (w: string) =>
    (checkins ?? []).find((c) => c.week_start === w) ?? null;
  const nt = (w: string) =>
    (notes ?? []).find((n) => n.week_start === w) ?? null;
  const names = catalogNames(catalog);
  const colors = disciplineColors(catalog);
  const discList = catalog.map((d) => ({
    id: d.id,
    name: d.name,
    color: colors[d.id],
  }));
  const fightWeek = p.next_fight_date ? mondayOf(p.next_fight_date) : null;

  const weekInfo = weekList.map((w) => {
    const cur = wk(w);
    const prev = wk(addDays(w, -7));
    const tl = trafficLight(cur.load, prev.load, !!ck(w)?.niggle);
    return { w, cur, prev, tl };
  });

  const chartWeeks: LoadChartWeek[] = weekInfo.map(({ w, cur, tl }) => ({
    week: w,
    label: dayMonth(w),
    total: cur.load,
    segments: catalog.map((d) => ({
      id: d.id,
      load: cur.byDiscipline[d.id] ?? 0,
    })),
    changePct: tl.changePct,
    light: tl.level,
    isFightWeek: w === fightWeek,
    inProgress: w === thisWeek,
  }));

  const lastWeek = addDays(thisWeek, -7);
  const headline = weekInfo.find((x) => x.w === lastWeek)!;
  const latestNiggle = [ck(thisWeek), ck(lastWeek)].find(Boolean);
  const headlineLight = trafficLight(
    headline.cur.load,
    headline.prev.load,
    !!latestNiggle?.niggle,
  );
  const fight = fightCountdown(p.next_fight_date, today);
  const joinedWeek = mondayOf(todayISO(new Date(p.created_at)));
  const limit =
    p.weight_class_limit_kg != null ? Number(p.weight_class_limit_kg) : null;

  const prefs = p as unknown as { coach_widgets: WidgetKey[] | null; home_trend: HomeTrend | null; feat_fights: boolean | null; feat_bodyweight: boolean | null };
  const kind = {
    fighter: prefs.feat_fights !== false && !!(p.weight_class || p.discipline?.name),
    bodyweight: prefs.feat_bodyweight !== false,
  };
  const chosenWidgets = prefs.coach_widgets?.length ? prefs.coach_widgets : defaultWidgets(kind);
  const widgets = await loadWidgets(supabase, id, todayISO(), chosenWidgets);
  const { data: campW } = p.next_fight_date
    ? await supabase.from("body_metrics").select("measured_on, weight_kg").eq("athlete_id", id).not("weight_kg", "is", null).gte("measured_on", addDays(today, -28)).order("measured_on")
    : { data: null };
  const camp = campStatus({ fight: p.next_fight_date, today, limitKg: limit, weights: (campW ?? []).map((r) => ({ date: r.measured_on as string, kg: Number(r.weight_kg) })) });

  return (
    <Screen wide>
      <ClientTabs id={id} name={p.full_name ?? p.email} active="overview" />
      <PopoverCloser />
      {/* Quick tools: compact chips; panels open only when tapped */}
      <div className="-mt-1 mb-5 flex flex-wrap items-center gap-2">
        <details data-popover className="relative" open={pageError === "feature"}>
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-bold">
            <SlidersHorizontal size={15} /> Features <span className="text-xs font-normal text-muted">{FEATURES.filter((f) => p[f.column] !== false).length}/{FEATURES.length}</span>
          </summary>
          <div className="absolute left-0 z-30 mt-2 max-h-[70vh] w-[min(92vw,460px)] overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
        <ul className="divide-y divide-line ">
          {FEATURES.map((f) => {
            const on = p[f.column] !== false;
            return (
              <li key={f.key}>
                <form
                  action={setAthleteFeature}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="column" value={f.column} />
                  <input type="hidden" name="on" value={String(!on)} />
                  <div className="min-w-0">
                    <p className="font-bold">{f.label}</p>
                    <p className="text-xs text-muted">{f.hint}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={`${f.label}: ${on ? "on" : "off"}`}
                    className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? "bg-ok" : "bg-surface-2 ring-1 ring-line"}`}
                  >
                    <span
                      className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${on ? "left-7" : "left-1"}`}
                    />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
          </div>
        </details>
        <details data-popover className="relative">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-bold">
            <BellRing size={15} /> Follow-ups{(followUps ?? []).length ? <span className="rounded-full bg-brand px-1.5 text-[11px] text-white">{(followUps ?? []).length}</span> : null}
          </summary>
          <div className="absolute left-0 z-30 mt-2 w-[min(92vw,520px)] rounded-2xl border border-line bg-surface p-3 shadow-2xl">
        <ul className="mt-2 space-y-1 text-sm">
          {(followUps ?? []).map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2">
              <span>
                <span className="text-muted">{f.due_on}</span> · {f.note}
              </span>
              <form action={clearFollowUp}>
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="back" value={`/coach/athlete/${id}`} />
                <button className="min-h-9 rounded-lg border border-line px-2 text-xs font-bold">Done</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addFollowUp} className="mt-2 grid grid-cols-[9.5rem_1fr_auto] gap-2">
          <input type="hidden" name="athlete_id" value={id} />
          <input type="hidden" name="back" value={`/coach/athlete/${id}`} />
          <input type="date" name="due_on" required className="min-h-11 rounded-xl border border-line bg-surface-2 px-2 text-text" aria-label="Follow up on" />
          <input name="note" required maxLength={500} placeholder="e.g. Check shoulder after sparring" className="min-h-11 min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text" aria-label="Note" />
          <button className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold">Add</button>
        </form>
          </div>
        </details>
        <Link href={`/coach/athlete/${id}/fights`} className="flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-bold">
          <Swords size={15} /> Competitions
        </Link>
        <Link href={`/coach/athlete/${id}/mobility`} className="flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-bold">
          <PersonStanding size={15} /> Mobility screen
        </Link>
        <Link href={`/coach/athlete/${id}/profile`} className="flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-bold">
          <UserPen size={15} /> Edit profile
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted">
            {[
              p.discipline?.name,
              p.weight_class &&
                `${p.weight_class}${limit ? ` (${limit} kg)` : ""}`,
              p.training_age_years != null &&
                `${Number(p.training_age_years)} yrs training`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-sm text-muted">{p.email}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <TrafficLight level={headlineLight.level} size="lg" />
          <span className="text-xs text-muted">
            {headlineLight.reasons.join(" · ") || "Last week on track"}
          </span>
        </div>
      </header>
      {camp && <div className="max-w-xl"><FightCampCard s={camp} limitKg={limit} coach /></div>}
      {pageError === "widgets" && (
        <p className="mb-3 rounded-xl border border-brand/60 bg-brand/10 px-4 py-3 text-sm font-bold text-brand">Those graphs didn&apos;t save. Please try again.</p>
      )}
      <ClientWidgets id={id} widgets={widgets} chosen={chosenWidgets} trend={prefs.home_trend} trendAuto={defaultHomeTrend(kind)} />

      {pageError === "feature" && (
        <p className="mb-3 rounded-xl border border-brand/60 bg-brand/10 px-4 py-3 text-sm font-bold text-brand">
          That switch didn&apos;t save. Please try again.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label="Last week load"
          value={headline.cur.load}
          sub={`${formatChange(headline.tl.changePct)} vs ${headline.prev.load}`}
        />
        <Tile
          label="This week so far"
          value={wk(thisWeek).load}
          sub={`${wk(thisWeek).count} sessions`}
        />
        <Tile
          label="Wellness (last wk)"
          value={ck(lastWeek) ? `${ck(lastWeek)!.wellness}/10` : "–"}
          sub={
            ck(lastWeek)
              ? wellnessLabel(ck(lastWeek)!.wellness)
              : "not submitted"
          }
        />
        <Tile
          label="Fight"
          value={
            fight
              ? fight.past
                ? "Passed"
                : fight.label.replace(" out", "")
              : "–"
          }
          sub={
            p.next_fight_date
              ? `${formatDate(p.next_fight_date)}${p.second_fight_date ? ` · then ${formatDate(p.second_fight_date)}` : ""}`
              : "not booked"
          }
        />
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Weekly load · last {WEEKS} weeks
        </h2>
        <CoachLoadCharts
          weeks={chartWeeks}
          daily={Object.fromEntries(
            weekList.map((w) => [w, dailyTotals(rows, weekDays(w))]),
          )}
          disciplines={discList}
          today={today}
        />
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Bodyweight
        </h2>
        <WeightChart
          points={weekList.map((w) => {
            const c = ck(w);
            return {
              week: w,
              label: dayMonth(w),
              kg: c?.bodyweight_kg != null ? Number(c.bodyweight_kg) : null,
            };
          })}
          limit={limit}
        />
      </Card>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
        Week by week
      </h2>
      <div className="mb-8 space-y-3">
        {[...weekInfo]
          // Start the list at the week they joined (or their first session, if logged earlier)
          .filter(({ w, cur }) => w >= joinedWeek || cur.count > 0)
          .reverse()
          .map(({ w, cur, tl }) => {
            const c = ck(w);
            const s = rows.filter((r) => r.week_start === w);
            const n = nt(w);
            return (
              <Card key={w} className="!p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-extrabold">
                    {dayMonth(w)} – {dayMonth(addDays(w, 6))}
                    {w === thisWeek && (
                      <span className="ml-2 text-xs font-normal text-brand">
                        This week
                      </span>
                    )}
                    {w === fightWeek && (
                      <span className="ml-2 text-xs font-bold">FIGHT WEEK</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span>
                      Load <b>{cur.load}</b>{" "}
                      {w !== thisWeek && (
                        <span className="text-muted">
                          {formatChange(tl.changePct)}
                        </span>
                      )}
                    </span>
                    {w !== thisWeek && <TrafficLight level={tl.level} />}
                  </div>
                </div>

                <p className="mb-2 text-sm text-muted">
                  {cur.count} sessions · {cur.minutes} min
                  {c ? ` · wellness ${c.wellness}/10` : " · not submitted"}
                  {c?.bodyweight_kg != null
                    ? ` · ${Number(c.bodyweight_kg)} kg`
                    : ""}
                </p>
                {c?.niggle && (
                  <p className="mb-2 rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-sm">
                    <b>Niggle:</b> {c.niggle_note}
                  </p>
                )}

                {s.length > 0 && (
                  <details className="mb-1">
                    <summary className="cursor-pointer text-sm text-muted">
                      Sessions
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm">
                      {s.map((x) => (
                        <li
                          key={x.id}
                          className="flex justify-between gap-3 border-t border-line pt-1"
                        >
                          <span>
                            <span
                              className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle"
                              style={{ background: colors[x.discipline_id] }}
                            />
                            {dayMonth(x.session_date)}{" "}
                            {formatTime(x.start_time)} ·{" "}
                            {names.disc.get(x.discipline_id)} ·{" "}
                            {names.type.get(x.session_type_id)} ·{" "}
                            {x.duration_min} min · RPE {x.rpe}{" "}
                            {RPE_LABELS[x.rpe]?.label}
                            {x.notes && (
                              <span className="block text-xs text-muted">
                                “{x.notes}”
                              </span>
                            )}
                          </span>
                          <b className="shrink-0">{x.load_au}</b>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <CoachNoteForm athleteId={id} week={w} initial={n} />
              </Card>
            );
          })}
      </div>

      <form action={setAthleteStatus} className="mb-8">
        <input type="hidden" name="id" value={id} />
        <input
          type="hidden"
          name="status"
          value={p.status === "inactive" ? "active" : "inactive"}
        />
        <button className="min-h-12 w-full rounded-xl border border-brand/60 text-sm font-extrabold uppercase tracking-wide text-brand">
          {p.status === "inactive" ? "Reactivate client" : "Deactivate client"}
        </button>
        <p className="mt-2 text-center text-xs text-muted">
          {p.status === "inactive"
            ? "Reactivating gives them their app back with everything as they left it."
            : "They lose access to the app, and automations and messages stop. All their data is kept, so you can reactivate them any time."}
        </p>
      </form>
    </Screen>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-[11px] uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className="text-xl font-black">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
