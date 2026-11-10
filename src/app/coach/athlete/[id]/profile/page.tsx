import { notFound } from "next/navigation";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import type { Discipline, Profile } from "@/lib/types";
import { ProfileForm } from "@/components/ProfileForm";
import { BackLink, Heading, Screen } from "@/components/ui";

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
    <Screen>
      <BackLink
        href={`/coach/athlete/${id}`}
        label={p.full_name ?? "Athlete"}
      />
      <Heading sub={`${p.email} · changes show on their account straight away`}>
        Edit profile
      </Heading>
      <ProfileForm
        profile={p}
        disciplines={list}
        submitLabel="Save changes"
        today={todayISO()}
        athleteId={id}
      />
    </Screen>
  );
}
