import Link from "next/link";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { fightCountdown } from "@/lib/fight";
import { Card, Logo, Screen, SignOutButton } from "@/components/ui";

export default async function AthleteHome() {
  const { supabase, profile } = await requireState(["athlete"]);
  const { data: disc } = profile.main_discipline_id
    ? await supabase.from("disciplines").select("name").eq("id", profile.main_discipline_id).maybeSingle()
    : { data: null };
  const fight = fightCountdown(profile.next_fight_date, todayISO());
  const first = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <Screen>
      <header className="mb-6 flex items-center justify-between">
        <Logo size={40} />
        <SignOutButton />
      </header>

      <h1 className="text-2xl font-black uppercase tracking-tight">Hey {first}</h1>
      <p className="mb-6 text-muted">
        {disc?.name ?? "Athlete"}
        {profile.weight_class ? ` · ${profile.weight_class} (${Number(profile.weight_class_limit_kg)} kg)` : ""}
      </p>

      {fight && profile.next_fight_date && (
        <Card className={`mb-4 ${fight.past ? "border-warn/60" : "border-brand/60"}`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Next fight</p>
          <p className="mt-1 text-3xl font-black">{fight.label}</p>
          <p className="text-sm text-muted">{formatDate(profile.next_fight_date)}</p>
        </Card>
      )}

      {/* Segment 2 replaces this card with the weekly check-in */}
      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Weekly check-in</p>
        <p className="mt-1 text-muted">Coming soon.</p>
      </Card>

      <Link href="/profile" className="text-sm text-muted underline underline-offset-4">
        Edit my profile
      </Link>
    </Screen>
  );
}
