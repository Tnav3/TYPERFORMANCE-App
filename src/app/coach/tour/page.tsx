import { requireState } from "@/lib/session";
import { Card, Heading, Screen } from "@/components/ui";
import { welcomeSteps } from "@/lib/tutorial";
import { saveTourVideos } from "./actions";

export const dynamic = "force-dynamic";
const input = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-sm text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export default async function TourPage() {
  const { supabase } = await requireState(["coach"]);
  const { data } = await supabase.from("tour_videos").select("key, url");
  const have = Object.fromEntries((data ?? []).map((r) => [r.key, r.url]));
  const steps = welcomeSteps({ role: "athlete" });
  return (
    <Screen>
      <Heading sub="What new clients see the first time they open the app. Steps for switched-off features are skipped for that client. Add a link to a short clip (YouTube unlisted works) and a Watch how button appears on that step.">Welcome tour</Heading>
      <form action={saveTourVideos} className="space-y-3">
        {steps.map((s, i) => (
          <Card key={s.key}>
            <p className="text-xs text-muted">Step {i + 1}</p>
            <h2 className="font-bold">{s.title}</h2>
            <p className="mb-2 text-sm text-muted">{s.body}</p>
            <input name={s.key} type="url" defaultValue={have[s.key] ?? ""} placeholder="https://youtu.be/… (optional)" className={input} />
          </Card>
        ))}
        <button className="min-h-11 w-full rounded-xl bg-brand font-bold text-white">Save clips</button>
      </form>
    </Screen>
  );
}
