import Link from "next/link";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { fightCountdown } from "@/lib/fight";
import type { AccountStatus, Profile } from "@/lib/types";
import { Card, Logo, Screen, SignOutButton } from "@/components/ui";
import { setAthleteStatus } from "./actions";

type Row = Profile & { discipline: { name: string } | null };

export default async function CoachHome() {
  const { supabase } = await requireState(["coach"]);
  const { data } = await supabase
    .from("profiles")
    .select("*, discipline:disciplines(name)")
    .eq("role", "athlete")
    .order("full_name", { ascending: true, nullsFirst: false });

  const rows = (data ?? []) as Row[];
  const today = todayISO();
  const pending = rows.filter((r) => r.status === "pending");
  const active = rows.filter((r) => r.status === "active");
  const inactive = rows.filter((r) => r.status === "inactive");

  return (
    <Screen wide>
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <h1 className="text-xl font-black uppercase tracking-tight">Athletes</h1>
        </div>
        <SignOutButton />
      </header>

      <Link
        href="/week"
        className="mb-8 flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface-2 font-extrabold uppercase tracking-wide"
      >
        Log my own training →
      </Link>

      <Section title="Waiting for approval" count={pending.length} empty="No one waiting.">
        {pending.map((r) => (
          <AthleteRow key={r.id} r={r} today={today} actions={[{ label: "Approve", status: "active", primary: true }, { label: "Decline", status: "inactive" }]} />
        ))}
      </Section>

      <Section title="Active" count={active.length} empty="No active athletes yet.">
        {active.map((r) => (
          <AthleteRow key={r.id} r={r} today={today} actions={[{ label: "Deactivate", status: "inactive" }]} />
        ))}
      </Section>

      <Section title="Deactivated" count={inactive.length} empty="None.">
        {inactive.map((r) => (
          <AthleteRow key={r.id} r={r} today={today} actions={[{ label: "Reactivate", status: "active" }]} />
        ))}
      </Section>
    </Screen>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
        {title} · {count}
      </h2>
      {count === 0 ? <p className="text-sm text-muted">{empty}</p> : <div className="space-y-3">{children}</div>}
    </section>
  );
}

function AthleteRow({
  r,
  today,
  actions,
}: {
  r: Row;
  today: string;
  actions: { label: string; status: AccountStatus; primary?: boolean }[];
}) {
  const fight = fightCountdown(r.next_fight_date, today);
  const onboarding = !r.consent_accepted_at ? "Hasn't accepted consent yet" : !r.profile_completed_at ? "Hasn't finished profile yet" : null;

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-extrabold">{r.full_name ?? "(no name)"}</p>
        <p className="truncate text-sm text-muted">{r.email}</p>
        <p className="mt-1 text-sm">
          {[
            r.discipline?.name,
            r.weight_class && `${r.weight_class} ${Number(r.weight_class_limit_kg)} kg`,
            r.training_age_years != null && `${Number(r.training_age_years)} yrs training`,
            fight && (fight.past ? "fight date passed" : `fight ${fight.label}`),
          ]
            .filter(Boolean)
            .join(" · ") || <span className="text-muted">No profile details yet</span>}
        </p>
        {onboarding && <p className="mt-1 text-xs text-warn">{onboarding}</p>}
        <p className="mt-1 text-xs text-muted">Joined {formatDate(todayISO(new Date(r.created_at)))}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {actions.map((a) => (
          <form key={a.label} action={setAthleteStatus}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="status" value={a.status} />
            <button
              className={`min-h-11 rounded-xl px-4 text-sm font-extrabold uppercase tracking-wide ${
                a.primary ? "bg-brand text-white" : "border border-line bg-surface-2 text-text"
              }`}
            >
              {a.label}
            </button>
          </form>
        ))}
      </div>
    </Card>
  );
}
