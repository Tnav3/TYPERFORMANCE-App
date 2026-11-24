import Link from "next/link";
import { requireState } from "@/lib/session";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { createGroup } from "@/app/coach/workouts/actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { error } = await searchParams;
  const { data } = await supabase
    .from("groups")
    .select("id, name, archived, group_members(athlete_id)")
    .order("name");
  const groups = (data ?? []) as unknown as {
    id: string;
    name: string;
    archived: boolean;
    group_members: { athlete_id: string }[];
  }[];

  return (
    <Screen wide>
      <BackLink href="/coach" label="Dashboard" />
      <Heading sub="Program a group once and every member gets it. You can still personalise a day for one person.">
        Groups
      </Heading>
      {error && <Alert>{error}</Alert>}
      <Card className="mb-6 !p-4">
        <form action={createGroup} className="flex gap-2">
          <input name="name" placeholder="e.g. Pro MMA camp, Fat loss" maxLength={60} required className={input} aria-label="Group name" />
          <button className="min-h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">
            Create
          </button>
        </form>
      </Card>
      <div className="space-y-2">
        {groups.filter((g) => !g.archived).map((g) => (
          <Link key={g.id} href={`/coach/groups/${g.id}`} className="block">
            <Card className="!p-3">
              <p className="font-bold">{g.name}</p>
              <p className="text-sm text-muted">
                {g.group_members.length} {g.group_members.length === 1 ? "member" : "members"}
              </p>
            </Card>
          </Link>
        ))}
        {groups.filter((g) => g.archived).length > 0 && (
          <details className="pt-4">
            <summary className="cursor-pointer text-sm text-muted">Archived groups</summary>
            {groups.filter((g) => g.archived).map((g) => (
              <Link key={g.id} href={`/coach/groups/${g.id}`} className="mt-2 block text-sm underline underline-offset-4">
                {g.name}
              </Link>
            ))}
          </details>
        )}
        {groups.length === 0 && <p className="text-muted">No groups yet.</p>}
      </div>
    </Screen>
  );
}
