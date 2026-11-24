import { ClientNavBar } from "@/components/ClientNavBar";
import Link from "next/link";
import { requireFeature } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { formatDate, todayISO } from "@/lib/dates";
import { addDays } from "@/lib/week";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { saveMacros } from "@/app/lifestyle-actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-12 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-center text-lg text-text focus:border-brand focus:outline-none";
const KEYS = [
  ["calories", "Calories", "kcal"],
  ["protein_g", "Protein", "g"],
  ["carbs_g", "Carbs", "g"],
  ["fat_g", "Fat", "g"],
] as const;

export default async function MacrosPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; day?: string }> }) {
  const { supabase, user, profile } = await requireFeature(["athlete"], "macros");
  const sp = await searchParams;
  const today = todayISO();
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today && sp.day >= addDays(today, -6) ? sp.day : today;
  const [{ data: target }, { data: logs }] = await Promise.all([
    supabase.from("macro_targets").select("*").eq("athlete_id", user!.id).maybeSingle(),
    supabase.from("macro_logs").select("*").eq("athlete_id", user!.id).gte("day", addDays(today, -13)).order("day", { ascending: false }),
  ]);
  const cur = (logs ?? []).find((l) => l.day === day);
  const week = (logs ?? []).filter((l) => l.day >= addDays(today, -6));
  const within = (l: Record<string, number | null>) =>
    target?.calories && l.calories != null ? Math.abs(l.calories - target.calories) / target.calories <= 0.1 : false;

  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading sub="Log your day's totals from your tracking app or label maths. Takes 10 seconds.">Macros</Heading>
      {sp.error && <Alert>{sp.error}</Alert>}
      {sp.saved && <Alert tone="ok">Saved.</Alert>}
      {target && (
        <div className="mb-4 grid grid-cols-4 gap-2 text-center">
          {KEYS.map(([k, label, unit]) => (
            <div key={k} className="rounded-xl bg-surface-2 p-2">
              <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
              <p className="font-black">{target[k] ?? "—"}</p>
              <p className="text-[10px] text-muted">{unit} target</p>
            </div>
          ))}
        </div>
      )}
      <Card className="mb-4">
        <div className="mb-2 flex gap-2 overflow-x-auto text-sm">
          {Array.from({ length: 7 }, (_, i) => addDays(today, -i)).map((d) => (
            <Link key={d} href={`/macros?day=${d}`} className={`shrink-0 rounded-full px-3 py-1 ${d === day ? "bg-brand text-white" : "bg-surface-2 text-muted"}`}>
              {d === today ? "Today" : formatDate(d).split(" ").slice(0, 2).join(" ")}
            </Link>
          ))}
        </div>
        <form action={saveMacros} className="space-y-3">
          <input type="hidden" name="day" value={day} />
          <div className="grid grid-cols-2 gap-2">
            {KEYS.map(([k, label, unit]) => (
              <label key={k} className="text-sm">
                <span className="mb-1 block text-muted">{label} ({unit})</span>
                <input name={k} inputMode="numeric" defaultValue={cur?.[k] ?? ""} className={input} />
              </label>
            ))}
          </div>
          <button className="min-h-12 w-full rounded-xl bg-brand font-extrabold uppercase text-white">Save {day === today ? "today" : formatDate(day)}</button>
        </form>
      </Card>
      <p className="mb-2 text-xs uppercase tracking-widest text-muted">
        Last 7 days · {week.length}/7 logged{target?.calories ? ` · ${week.filter(within).length} within 10% of calories` : ""}
      </p>
      <div className="space-y-1 text-sm">
        {week.map((l) => (
          <div key={l.day} className="flex justify-between rounded-lg bg-surface px-3 py-2">
            <span className="text-muted">{formatDate(l.day)}</span>
            <span>
              {l.calories ?? "—"} kcal · P{l.protein_g ?? "—"} C{l.carbs_g ?? "—"} F{l.fat_g ?? "—"}
            </span>
          </div>
        ))}
      </div>
      {hasFeature(profile, "mealplan") && (
        <Link href="/meal-plan" className="mt-6 block text-sm font-bold text-brand">Sample meal plan →</Link>
      )}
      <ClientNavBar supabase={supabase} profile={profile} userId={user!.id} />
    </Screen>
  );
}
