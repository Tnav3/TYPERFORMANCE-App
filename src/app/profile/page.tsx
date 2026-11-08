import Link from "next/link";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import type { Discipline } from "@/lib/types";
import { Heading, Screen } from "@/components/ui";
import { ProfileForm } from "@/components/ProfileForm";

// Athletes update fight date, weight class etc. as things change.
export default async function EditProfilePage() {
  const { supabase, profile, state } = await requireState(["athlete", "pending"]);
  const { data: disciplines } = await supabase
    .from("disciplines")
    .select("id, name, sort_order, active")
    .order("sort_order");

  // Show active disciplines, plus the athlete's current one even if the coach has since hidden it
  const list = ((disciplines ?? []) as Discipline[]).filter(
    (d) => d.active || d.id === profile.main_discipline_id
  );

  return (
    <Screen>
      <Link href={state === "athlete" ? "/athlete" : "/pending"} className="mb-6 inline-block text-sm text-muted">
        ← Back
      </Link>
      <Heading>My profile</Heading>
      <ProfileForm profile={profile} disciplines={list} submitLabel="Save changes" today={todayISO()} />
    </Screen>
  );
}
