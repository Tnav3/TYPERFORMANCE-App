import Link from "next/link";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import type { Discipline } from "@/lib/types";
import { Heading, Screen, BackLink } from "@/components/ui";
import { ProfileForm } from "@/components/ProfileForm";
import { replayTutorial } from "@/app/tutorial/actions";

// Athletes update fight date, weight class etc. as things change.
export default async function EditProfilePage() {
  const { supabase, profile, state } = await requireState([
    "athlete",
    "pending",
  ]);
  const { data: disciplines } = await supabase
    .from("disciplines")
    .select("id, name, sort_order, active")
    .order("sort_order");

  // Show active disciplines, plus the athlete's current one even if the coach has since hidden it
  const list = ((disciplines ?? []) as Discipline[]).filter(
    (d) => d.active || d.id === profile.main_discipline_id,
  );

  const home = state === "athlete" ? "/athlete" : "/pending";

  return (
    <Screen>
      <BackLink href={home} />
      <Heading>My profile</Heading>
      <ProfileForm
        profile={profile}
        disciplines={list}
        submitLabel="Save changes"
        today={todayISO()}
      />
      {state === "athlete" && (
        <form action={replayTutorial} className="mt-6">
          <button className="text-sm font-bold text-muted underline underline-offset-4">
            Replay the app tour
          </button>
        </form>
      )}
      {/* Second way out, where the thumb already is */}
      <Link
        href={home}
        className="mt-3 flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface-2 font-extrabold uppercase tracking-wide text-text"
      >
        Back
      </Link>
    </Screen>
  );
}
