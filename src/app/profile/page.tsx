import Link from "next/link";
import { requireState } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import type { Discipline } from "@/lib/types";
import { Heading, Screen, BackLink } from "@/components/ui";
import { ProfileForm } from "@/components/ProfileForm";
import { replayTutorial } from "@/app/tutorial/actions";
import { AvatarUploader } from "@/components/AvatarUploader";
import { saveAboutMe } from "./about-actions";

const field = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

// Athletes update fight date, weight class etc. as things change.
export default async function EditProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { supabase, profile, state, viewAs } = await requireState([
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

  const sp = await searchParams;
  const me = profile as unknown as { id: string; full_name: string | null; email: string; avatar_path: string | null; nickname: string | null; goal_text: string | null; about_me: string | null };
  // Coach viewing as this client: saving here is switched off, so send them to the coach editor instead
  if (viewAs)
    return (
      <Screen>
        <BackLink href="/athlete" />
        <Heading>My profile</Heading>
        <div className="rounded-2xl border border-brand/50 bg-brand/10 p-4">
          <p className="font-extrabold">You&apos;re viewing as {me.full_name ?? "this client"}.</p>
          <p className="mt-1 text-sm text-muted">Profile changes can&apos;t be saved from here. Edit their details from your coach screen and they show on their app straight away.</p>
          <Link href={`/coach/athlete/${me.id}/profile`} className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-brand font-extrabold uppercase text-white">Edit their profile</Link>
        </div>
      </Screen>
    );
  const home = state === "athlete" ? "/athlete" : "/pending";

  return (
    <Screen>
      <BackLink href={home} />
      <Heading>My profile</Heading>
      {viewAs && (
        <div className="mb-4 rounded-2xl border border-warn/50 bg-warn/10 p-4 text-sm">
          You&apos;re viewing as this client, so their profile can&apos;t be saved here.{" "}
          <Link href={`/coach/athlete/${profile.id}/profile`} className="font-bold underline">Edit it from the coach side →</Link>
        </div>
      )}
      <section id="about" className="mb-6 rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">About you</h2>
        <AvatarUploader userId={me.id} name={me.full_name ?? me.email} path={me.avatar_path} />
        <form action={saveAboutMe} className="mt-4">
          <fieldset disabled={!!viewAs} className="m-0 min-w-0 space-y-3 border-0 p-0">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Fight name / nickname</span>
            <input name="nickname" maxLength={40} defaultValue={me.nickname ?? ""} placeholder="e.g. The Hammer" className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Your goal, in your words</span>
            <input name="goal_text" maxLength={200} defaultValue={me.goal_text ?? ""} placeholder="e.g. Make 70 kg and win my first amateur fight" className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">About me</span>
            <textarea name="about_me" rows={3} maxLength={500} defaultValue={me.about_me ?? ""} placeholder="Your sport, how long you've trained, what drives you" className={`${field} py-2`} />
          </label>
          {sp.saved === "about" && <p className="text-sm font-bold text-ok">Saved.</p>}
          {sp.error === "about" && <p className="text-sm font-bold text-brand">That didn&apos;t save. Please try again.</p>}
          <button className="min-h-11 w-full rounded-xl bg-brand font-extrabold uppercase text-white disabled:opacity-50">Save about you</button>
          </fieldset>
        </form>
      </section>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">Training & competition</h2>
      <ProfileForm
        profile={profile}
        disciplines={list}
        submitLabel="Save training details"
        readOnly={!!viewAs}
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
