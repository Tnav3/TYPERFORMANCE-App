import { requireFeature } from "@/lib/session";
import { BackLink, Heading, Screen } from "@/components/ui";
import { OwnWorkoutBuilder } from "@/components/OwnWorkoutBuilder";
import { isISODate, todayISO } from "@/lib/dates";
import { addDays, dayMonth, dayShort } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function NewOwnWorkoutPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requireFeature(["athlete"], "program");
  const { d } = await searchParams;
  const today = todayISO();
  const days = [1, 0, -1, -2, -3, -4, -5, -6].map((n) => {
    const iso = addDays(today, n);
    return { iso, label: n === 0 ? "Today" : n === -1 ? "Yesterday" : n === 1 ? "Tomorrow" : `${dayShort(iso)} ${dayMonth(iso)}` };
  });
  const initial = d && isISODate(d) && days.some((x) => x.iso === d) ? d : today;
  return (
    <Screen>
      <BackLink href="/train" label="Training" />
      <Heading sub="For a day with nothing on, or extra work you did. Your coach will see it.">Add a workout</Heading>
      <OwnWorkoutBuilder days={days} initialDate={initial} />
    </Screen>
  );
}
