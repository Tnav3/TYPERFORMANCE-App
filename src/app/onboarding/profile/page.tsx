import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import type { Discipline } from "@/lib/types";
import { Heading, Screen, SignOutButton } from "@/components/ui";
import { ProfileForm } from "@/components/ProfileForm";

export default async function OnboardingProfilePage() {
  const { supabase, profile } = await requireState(["needs_profile"]);
  const { data: disciplines } = await supabase
    .from("disciplines")
    .select("id, name, sort_order, active")
    .eq("active", true)
    .order("sort_order");

  return (
    <Screen>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
        Step 2 of 2
      </p>
      <Heading sub="This helps your coach plan your training around fights and weight.">
        Your profile
      </Heading>
      <ProfileForm
        profile={profile}
        disciplines={(disciplines ?? []) as Discipline[]}
        submitLabel="Finish"
        today={todayISO()}
      />
      <div className="mt-6 text-center">
        <SignOutButton />
      </div>
    </Screen>
  );
}
