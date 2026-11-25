import { ClientTabs } from "@/components/ClientTabs";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import type { Discipline, Profile } from "@/lib/types";
import { ProfileForm } from "@/components/ProfileForm";
import { Screen } from "@/components/ui";
import { setTargetWeight } from "@/app/coach/widget-actions";
import { setAssignedCoach, setBeta, setClientPlan } from "@/app/coach/settings/plans/actions";

export const dynamic = "force-dynamic";

export default async function CoachEditProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const { data: coaches } = await supabase.from("profiles").select("id, full_name, email").eq("role", "coach").eq("status", "active").order("created_at");
  const [{ data: p }, { data: disciplines }, { data: plans }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>(),
    supabase
      .from("disciplines")
      .select("id, name, sort_order, active")
      .order("sort_order"),
    supabase.from("coaching_plans").select("key, name").eq("active", true).order("sort_order"),
  ]);
  if (!p) notFound();
  const list = ((disciplines ?? []) as Discipline[]).filter(
    (d) => d.active || d.id === p.main_discipline_id,
  );

  return (
    <Screen wide>
      <ClientTabs id={id} name={p.full_name ?? p.email} active="profile" sub="Changes show on their account straight away" />
      <div className="max-w-2xl">
      <ProfileForm
        profile={p}
        disciplines={list}
        submitLabel="Save changes"
        today={todayISO()}
        athleteId={id}
      />
      <form action={setBeta} className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="beta" value={String(!(p as unknown as { beta: boolean }).beta)} />
        <span className="text-sm">
          <span className="block font-bold">Beta tester {(p as unknown as { beta: boolean }).beta ? "✓" : ""}</span>
          <span className="text-xs text-muted">Beta testers get new features first and you&apos;ll see a BETA tag on their feedback.</span>
        </span>
        <button className="min-h-11 shrink-0 rounded-xl border border-line bg-surface-2 px-4 text-sm font-bold">{(p as unknown as { beta: boolean }).beta ? "Remove" : "Make beta tester"}</button>
      </form>
      {(coaches ?? []).length > 1 && (
        <form action={setAssignedCoach} className="mt-6 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-4">
          <input type="hidden" name="id" value={id} />
          <label className="min-w-48 flex-1 text-sm">
            <span className="mb-1 block font-bold">Coach</span>
            <select name="coach" defaultValue={(p as unknown as { assigned_coach: string | null }).assigned_coach ?? ""} className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-text">
              <option value="">Not assigned</option>
              {(coaches ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name ?? c.email}</option>)}
            </select>
          </label>
          <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold text-white">Save</button>
        </form>
      )}
      <form action={setClientPlan} className="mt-6 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-4">
        <input type="hidden" name="id" value={id} />
        <label className="min-w-48 flex-1 text-sm">
          <span className="mb-1 block font-bold">Coaching plan</span>
          <span className="mb-1 block text-xs text-muted">Sets their Book button (catch-up call or session). <a href="/coach/settings/plans" className="underline">Edit plans &amp; links</a></span>
          <select name="plan" defaultValue={(p as unknown as { plan_key: string | null }).plan_key ?? ""} className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-text">
            <option value="">No plan</option>
            {(plans ?? []).map((pl) => <option key={pl.key} value={pl.key}>{pl.name}</option>)}
          </select>
        </label>
        <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold text-white">Save</button>
      </form>
      <form action={setTargetWeight} className="mt-6 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-4">
        <input type="hidden" name="id" value={id} />
        <label className="min-w-48 flex-1 text-sm">
          <span className="mb-1 block font-bold">Target weight (kg), coach only</span>
          <span className="mb-1 block text-xs text-muted">Used by the &quot;Target weight reached&quot; automation. Works for cutting or gaining.</span>
          <input name="target" type="number" step="0.1" min={30} max={250} inputMode="decimal" defaultValue={(p as unknown as { target_weight_kg: number | null }).target_weight_kg ?? ""} className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-text" />
        </label>
        <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold text-white">Save</button>
      </form>
      </div>
    </Screen>
  );
}
