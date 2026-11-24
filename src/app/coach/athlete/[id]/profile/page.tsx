import { ClientTabs } from "@/components/ClientTabs";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import type { Discipline, Profile } from "@/lib/types";
import { ProfileForm } from "@/components/ProfileForm";
import { Screen } from "@/components/ui";
import { setTargetWeight } from "@/app/coach/widget-actions";

export const dynamic = "force-dynamic";

export default async function CoachEditProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { id } = await params;
  const [{ data: p }, { data: disciplines }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>(),
    supabase
      .from("disciplines")
      .select("id, name, sort_order, active")
      .order("sort_order"),
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
