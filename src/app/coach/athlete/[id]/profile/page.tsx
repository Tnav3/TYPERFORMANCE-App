import { ClientTabs } from "@/components/ClientTabs";
import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import type { Discipline, Profile } from "@/lib/types";
import { ProfileForm } from "@/components/ProfileForm";
import { Screen } from "@/components/ui";

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
      </div>
    </Screen>
  );
}
