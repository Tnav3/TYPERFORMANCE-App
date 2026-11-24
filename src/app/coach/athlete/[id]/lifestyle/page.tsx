import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { addDays, dayShort } from "@/lib/week";
import { bodyweights } from "@/lib/programming/history-data";
import { PhotoGallery } from "@/components/PhotoGallery";
import { habitStats } from "@/lib/programming/habits";
import { BodyweightTrend } from "@/components/ProgressViews";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { addHabit, setHabitActive, setMacroTargets } from "@/app/lifestyle-actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";
const smallBtn = "min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold";

export default async function LifestylePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const { error } = await searchParams;
  const today = todayISO();
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27));
  const [{ data: client }, { data: habits }, { data: hlogs }, { data: target }, { data: mlogs }, weights] = await Promise.all([
    supabase.from("profiles").select("full_name, email, feat_habits, feat_macros, feat_photos, weight_class_limit_kg").eq("id", id).maybeSingle(),
    supabase.from("habits").select("id, name, active").eq("athlete_id", id).order("active", { ascending: false }).order("created_at"),
    supabase.from("habit_logs").select("habit_id, day").eq("athlete_id", id).gte("day", addDays(today, -120)),
    supabase.from("macro_targets").select("*").eq("athlete_id", id).maybeSingle(),
    supabase.from("macro_logs").select("*").eq("athlete_id", id).gte("day", addDays(today, -13)).order("day", { ascending: false }),
    bodyweights(supabase, id),
  ]);
  if (!client) notFound();
  const stats = habitStats((habits ?? []).filter((h) => h.active).map((h) => h.id), hlogs ?? [], today);
  const hit = new Set((hlogs ?? []).map((l) => `${l.habit_id}|${l.day}`));
  const name = client.full_name ?? client.email;
  const off = [!client.feat_habits && "Habits", !client.feat_macros && "Macros", !client.feat_photos && "Photos"].filter(Boolean);

  return (
    <Screen wide>
      <BackLink href={`/coach/athlete/${id}`} label={name} />
      <Heading>Habits &amp; nutrition</Heading>
      {error && <Alert>{error}</Alert>}
      {off.length > 0 && (
        <Alert tone="info">Switched off for this client: {off.join(", ")}. Turn them on from their profile&apos;s features.</Alert>
      )}

      <Card className="mb-6 !p-4">
        <h2 className="mb-1 font-extrabold">Habits · last 4 weeks</h2>
        <p className="mb-3 text-sm text-muted">
          This week {stats.weekScore}% · perfect-day streak 🔥 {stats.perfectStreak}
        </p>
        <div className="space-y-3 overflow-x-auto">
          {(habits ?? []).map((h) => (
            <div key={h.id} className={h.active ? "" : "opacity-50"}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="font-bold">
                  {h.name}{" "}
                  <span className="font-normal text-muted">
                    {days.filter((d) => hit.has(`${h.id}|${d}`)).length}/28
                    {(stats.perHabit.get(h.id) ?? 0) > 1 && ` · 🔥 ${stats.perHabit.get(h.id)}`}
                  </span>
                </span>
                <form action={setHabitActive}>
                  <input type="hidden" name="athlete_id" value={id} />
                  <input type="hidden" name="id" value={h.id} />
                  <input type="hidden" name="active" value={String(!h.active)} />
                  <button className="text-xs text-muted underline underline-offset-4">{h.active ? "Stop" : "Restart"}</button>
                </form>
              </div>
              <div className="grid min-w-[560px] grid-cols-[repeat(28,minmax(0,1fr))] gap-0.5">
                {days.map((d) => (
                  <span
                    key={d}
                    title={`${dayShort(d)} ${d}`}
                    className={`h-5 rounded-sm ${hit.has(`${h.id}|${d}`) ? "bg-ok" : d === today ? "bg-line" : "bg-surface-2"}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <form action={addHabit} className="mt-4 flex gap-2">
          <input type="hidden" name="athlete_id" value={id} />
          <input name="name" required maxLength={80} placeholder="e.g. 8,000 steps · 3 L water · in bed by 10" className={input} aria-label="New habit" />
          <button className={smallBtn}>Add habit</button>
        </form>
      </Card>

      <Card className="mb-6 !p-4">
        <h2 className="mb-3 font-extrabold">Macro targets</h2>
        <form action={setMacroTargets} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input type="hidden" name="athlete_id" value={id} />
          {([["calories", "kcal"], ["protein_g", "Protein g"], ["carbs_g", "Carbs g"], ["fat_g", "Fat g"]] as const).map(([k, l]) => (
            <label key={k} className="text-xs text-muted">
              {l}
              <input name={k} inputMode="numeric" defaultValue={target?.[k] ?? ""} className={input} />
            </label>
          ))}
          <button className={`${smallBtn} self-end`}>Save</button>
        </form>
        <p className="mt-3 mb-1 text-xs uppercase tracking-widest text-muted">Logged · last 14 days</p>
        <div className="space-y-1 text-sm">
          {(mlogs ?? []).map((l) => (
            <div key={l.day} className="flex justify-between rounded-lg bg-surface-2 px-3 py-1.5">
              <span className="text-muted">{formatDate(l.day)}</span>
              <span>
                {l.calories ?? "—"} kcal · P{l.protein_g ?? "—"} C{l.carbs_g ?? "—"} F{l.fat_g ?? "—"}
                {target?.calories && l.calories != null && (
                  <span className={`ml-2 ${Math.abs(l.calories - target.calories) / target.calories <= 0.1 ? "text-ok" : "text-warn"}`}>
                    {l.calories - target.calories >= 0 ? "+" : ""}
                    {l.calories - target.calories}
                  </span>
                )}
              </span>
            </div>
          ))}
          {!(mlogs ?? []).length && <p className="text-muted">Nothing logged yet.</p>}
        </div>
      </Card>

      {weights.length > 0 && (
        <div className="mb-6">
          <BodyweightTrend rows={weights} limit={client.weight_class_limit_kg != null ? Number(client.weight_class_limit_kg) : null} />
        </div>
      )}

      <Card className="!p-4">
        <h2 className="mb-3 font-extrabold">Progress photos</h2>
        <PhotoGallery supabase={supabase} athleteId={id} back={`/coach/athlete/${id}/lifestyle`} />
      </Card>
    </Screen>
  );
}
