import Link from "next/link";
import { redirect } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import {
  addDays,
  dayMonth,
  dayShort,
  editableWeeks,
  formatTime,
  isEditableWeek,
  mondayOf,
  weekDays,
  weekLabel,
} from "@/lib/week";
import { RPE_LABELS } from "@/lib/scales";
import { catalogNames, getCatalog } from "@/lib/catalog";
import { disciplineColors } from "@/lib/colors";
import { dailyTotals } from "@/lib/load-metrics";
import { DailyLoadChart } from "@/components/DailyLoadChart";
import { Alert, Card, Screen, BackLink } from "@/components/ui";
import { CheckinForm, type ExistingCheckin } from "@/components/CheckinForm";

interface SessionRow {
  id: string;
  session_date: string;
  start_time: string;
  duration_min: number;
  discipline_id: string;
  session_type_id: string;
  rpe: number;
  load_au: number;
  notes: string | null;
}

export default async function WeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ start: string }>;
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  const { supabase, user, profile } = await requireState(["athlete", "coach"]);
  const { start } = await params;
  const { saved, deleted } = await searchParams;
  const today = todayISO();
  if (!isEditableWeek(start, today)) redirect(`/week/${mondayOf(today)}`);

  const days = weekDays(start);
  const [catalog, { data: sessions }, { data: checkin }, { data: coachNote }] =
    await Promise.all([
      getCatalog(supabase),
      // Always filter by the logged-in user: the coach can read everyone's rows
      supabase
        .from("training_sessions")
        .select(
          "id, session_date, start_time, duration_min, discipline_id, session_type_id, rpe, load_au, notes",
        )
        .eq("athlete_id", user!.id)
        .eq("week_start", start)
        .order("session_date")
        .order("start_time"),
      supabase
        .from("weekly_checkins")
        .select("wellness, bodyweight_kg, niggle, niggle_note, submitted_at")
        .eq("athlete_id", user!.id)
        .eq("week_start", start)
        .maybeSingle(),
      // Only notes the coach chose to share are readable (enforced by the database)
      supabase
        .from("coach_notes")
        .select("note, updated_at")
        .eq("athlete_id", user!.id)
        .eq("week_start", start)
        .eq("visible_to_athlete", true)
        .maybeSingle(),
    ]);
  const names = catalogNames(catalog);
  const colors = disciplineColors(catalog);
  const list = (sessions ?? []) as SessionRow[];
  const totalLoad = list.reduce((s, r) => s + r.load_au, 0);
  const totalMin = list.reduce((s, r) => s + r.duration_min, 0);

  const weeks = editableWeeks(today);
  const idx = weeks.indexOf(start);
  const newer = idx > 0 ? weeks[idx - 1] : null;
  const older = idx < weeks.length - 1 ? weeks[idx + 1] : null;
  const addDay = days.includes(today) ? today : days[6];

  return (
    <Screen>
      <BackLink href="/" label="Home" />

      <header className="mb-4 flex items-center justify-between">
        {older ? (
          <Link
            href={`/week/${older}`}
            aria-label="Previous week"
            className="grid h-11 w-11 place-items-center rounded-xl border border-line text-xl"
          >
            ‹
          </Link>
        ) : (
          <span className="h-11 w-11" />
        )}
        <div className="text-center">
          <h1 className="text-xl font-black uppercase tracking-tight">
            {weekLabel(start, today)}
          </h1>
          <p className="text-sm text-muted">
            {dayMonth(start)} – {dayMonth(addDays(start, 6))}
          </p>
        </div>
        {newer ? (
          <Link
            href={`/week/${newer}`}
            aria-label="Next week"
            className="grid h-11 w-11 place-items-center rounded-xl border border-line text-xl"
          >
            ›
          </Link>
        ) : (
          <span className="h-11 w-11" />
        )}
      </header>

      {saved && <Alert tone="ok">Session saved.</Alert>}
      {deleted && <Alert tone="info">Session deleted.</Alert>}

      {coachNote && (
        <Card className="mb-4 border-brand/60">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            Note from your coach
          </p>
          <p className="mt-1 whitespace-pre-line">{coachNote.note}</p>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[
          { l: "Sessions", v: list.length },
          { l: "Minutes", v: totalMin },
          { l: "Load", v: totalLoad },
        ].map((s) => (
          <div
            key={s.l}
            className="rounded-xl border border-line bg-surface py-3"
          >
            <p className="text-2xl font-black">{s.v}</p>
            <p className="text-xs uppercase tracking-widest text-muted">
              {s.l}
            </p>
          </div>
        ))}
      </div>

      {list.length > 0 && (
        <Card className="mb-4 !p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            Load by day
          </h2>
          <DailyLoadChart
            days={dailyTotals(list, days)}
            disciplines={catalog.map((d) => ({
              id: d.id,
              name: d.name,
              color: colors[d.id],
            }))}
            today={today}
          />
        </Card>
      )}

      <Link
        href={`/week/${start}/session/new?day=${addDay}`}
        className="mb-6 flex min-h-14 items-center justify-center rounded-xl bg-brand text-lg font-extrabold uppercase tracking-wide text-white"
      >
        + Add session
      </Link>

      <section className="mb-8 space-y-4">
        {days.map((d) => {
          const daySessions = list.filter((s) => s.session_date === d);
          const future = d > today;
          return (
            <div key={d} className={future ? "opacity-40" : ""}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <h2 className="text-sm font-extrabold uppercase">
                  {dayShort(d)}{" "}
                  <span className="font-normal text-muted">{dayMonth(d)}</span>
                  {d === today && (
                    <span className="ml-2 text-xs text-brand">Today</span>
                  )}
                </h2>
                {!future && (
                  <Link
                    href={`/week/${start}/session/new?day=${d}`}
                    className="text-sm text-muted underline underline-offset-4"
                  >
                    + Add
                  </Link>
                )}
              </div>
              {daySessions.length === 0 ? (
                <p className="text-sm text-muted/60">
                  {future ? "" : "Rest / nothing logged"}
                </p>
              ) : (
                <div className="space-y-2">
                  {daySessions.map((s) => (
                    <Link
                      key={s.id}
                      href={`/week/${start}/session/${s.id}`}
                      className="block"
                    >
                      <Card className="flex items-center justify-between !p-4 hover:border-muted">
                        <div className="min-w-0">
                          <p className="truncate font-extrabold">
                            {names.disc.get(s.discipline_id)} ·{" "}
                            {names.type.get(s.session_type_id)}
                          </p>
                          <p className="text-sm text-muted">
                            {formatTime(s.start_time)} · {s.duration_min} min ·
                            RPE {s.rpe} {RPE_LABELS[s.rpe]?.label}
                          </p>
                        </div>
                        <div className="ml-3 shrink-0 text-right">
                          <p className="text-lg font-black">{s.load_au}</p>
                          <p className="text-xs text-muted">load</p>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <CheckinForm
        week={start}
        existing={(checkin as ExistingCheckin) ?? null}
        sessionCount={list.length}
        weightClassLimit={
          profile.weight_class_limit_kg != null
            ? Number(profile.weight_class_limit_kg)
            : null
        }
      />
    </Screen>
  );
}
