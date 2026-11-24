import Link from "next/link";
import { requireState } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { currentDue, REPEAT_LABEL, type Repeat } from "@/lib/forms";
import { Alert, BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MyForms({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { supabase, user } = await requireState(["athlete"]);
  const { sent } = await searchParams;
  const today = todayISO();
  const [{ data: asg }, { data: resp }] = await Promise.all([
    supabase.from("form_assignments").select("id, form_id, repeat, starts_on, active, forms(name, description, archived)").eq("athlete_id", user!.id).eq("active", true),
    supabase.from("form_responses").select("form_id, due_on, submitted_at").eq("athlete_id", user!.id).order("submitted_at", { ascending: false }).limit(50),
  ]);
  const rows = (asg ?? [])
    .map((a) => {
      const f = a.forms as unknown as { name: string; description: string | null; archived: boolean } | null;
      const due = currentDue({ repeat: a.repeat as Repeat, starts_on: a.starts_on }, today);
      const done = !!due && (resp ?? []).some((r) => r.form_id === a.form_id && r.due_on === due);
      return { ...a, f, due, done };
    })
    .filter((r) => r.f && !r.f.archived);
  const todo = rows.filter((r) => r.due && !r.done);
  const rest = rows.filter((r) => !r.due || r.done);

  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading sub="Quick check-ins from your coach.">Check-ins</Heading>
      {sent && <Alert tone="ok">Sent. Your coach will see it.</Alert>}
      {todo.length === 0 && <p className="mb-4 rounded-2xl border border-ok/40 bg-ok/10 p-4 font-bold text-ok">You&apos;re all caught up.</p>}
      <div className="space-y-3">
        {todo.map((r) => (
          <Link key={r.id} href={`/forms/${r.id}`} className="block rounded-2xl border border-brand bg-brand/10 p-4">
            <p className="text-lg font-black uppercase leading-tight tracking-tight">{r.f!.name}</p>
            <p className="mt-1 text-sm text-muted">Due {formatDate(r.due!)}</p>
            <p className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-brand font-extrabold uppercase tracking-wide text-white">Fill it in</p>
          </Link>
        ))}
      </div>
      {rest.length > 0 && (
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
          {rest.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-bold">{r.f!.name}</span>
              <span className="text-muted">{r.done ? "Done ✓" : `Starts ${formatDate(r.starts_on)}`} · {REPEAT_LABEL[r.repeat as Repeat]}</span>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
