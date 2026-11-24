import { requireState } from "@/lib/session";
import { hasFeature } from "@/lib/features";
import { PushSetup } from "@/components/PushSetup";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { saveNotificationPrefs } from "./actions";

export const dynamic = "force-dynamic";

const check = "h-5 w-5 accent-[var(--color-brand)]";
const input = "min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-text";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { profile, state } = await requireState(["athlete", "coach"]);
  const { saved } = await searchParams;
  const p = profile as typeof profile & {
    notify_messages?: boolean;
    notify_workouts?: boolean;
    workout_reminder_time?: string | null;
    habit_reminder_time?: string | null;
  };
  return (
    <Screen>
      <BackLink href={state === "coach" ? "/coach" : "/"} label="Home" />
      <Heading sub="Get a ping on your phone for messages, new workouts and reminders.">Notifications</Heading>
      {saved && <Alert tone="ok">Saved.</Alert>}
      <Card className="mb-4">
        <PushSetup vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
      </Card>
      <Card>
        <form action={saveNotificationPrefs} className="space-y-3">
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="notify_messages" defaultChecked={p.notify_messages !== false} className={check} />
            {state === "coach" ? "New client messages" : "Messages from your coach"}
          </label>
          {state !== "coach" && (
            <>
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name="notify_workouts" defaultChecked={p.notify_workouts !== false} className={check} />
                New programs and workouts
              </label>
              {hasFeature(profile, "program") && (
                <label className="flex min-h-11 flex-wrap items-center gap-3">
                  <input type="checkbox" name="workout_reminder" defaultChecked={!!p.workout_reminder_time} className={check} />
                  Remind me on training days at
                  <input type="time" name="workout_reminder_time" defaultValue={p.workout_reminder_time?.slice(0, 5) ?? "07:00"} className={input} />
                </label>
              )}
              {hasFeature(profile, "habits") && (
                <label className="flex min-h-11 flex-wrap items-center gap-3">
                  <input type="checkbox" name="habit_reminder" defaultChecked={!!p.habit_reminder_time} className={check} />
                  Remind me about habits at
                  <input type="time" name="habit_reminder_time" defaultValue={p.habit_reminder_time?.slice(0, 5) ?? "19:00"} className={input} />
                </label>
              )}
            </>
          )}
          <button className="min-h-12 w-full rounded-xl border border-line bg-surface-2 font-extrabold uppercase">Save</button>
        </form>
      </Card>
    </Screen>
  );
}
