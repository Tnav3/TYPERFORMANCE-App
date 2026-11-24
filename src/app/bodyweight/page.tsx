import { requireFeature } from "@/lib/session";
import { formatDate, todayISO } from "@/lib/dates";
import { bodyweights } from "@/lib/programming/history-data";
import { BodyweightTrend } from "@/components/ProgressViews";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";
import { deleteBodyweight, saveBodyweight } from "@/app/train/progress-actions";

export const dynamic = "force-dynamic";

const input =
  "min-h-12 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export default async function BodyweightPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { supabase, user, profile } = await requireFeature(["athlete"], "bodyweight");
  const sp = await searchParams;
  const rows = await bodyweights(supabase, user!.id);
  const today = todayISO();
  const todays = rows.find((r) => r.date === today);
  const limit = profile.weight_class_limit_kg != null ? Number(profile.weight_class_limit_kg) : null;

  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading sub="Weigh in first thing in the morning, after the toilet, before food.">Bodyweight</Heading>
      {sp.error && <Alert>{sp.error}</Alert>}
      {sp.saved && <Alert tone="ok">Saved.</Alert>}
      <Card className="mb-4">
        <form action={saveBodyweight} className="space-y-3">
          <input type="hidden" name="date" value={today} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted">Today (kg)</span>
              <input name="kg" inputMode="decimal" required defaultValue={todays?.kg ?? ""} className={input} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Waist cm (optional)</span>
              <input name="waist" inputMode="decimal" defaultValue={todays?.waist ?? ""} className={input} />
            </label>
          </div>
          <button className="min-h-12 w-full rounded-xl bg-brand font-extrabold uppercase text-white">
            {todays ? "Update" : "Save"}
          </button>
        </form>
      </Card>
      {rows.length > 0 && <BodyweightTrend rows={rows} limit={limit} />}
      <div className="mt-4 space-y-1">
        {rows.slice(0, 30).map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg px-2 py-1 text-sm">
            <span className="text-muted">{formatDate(r.date)}</span>
            <span className="font-bold">
              {r.kg} kg{r.waist != null && <span className="ml-2 font-normal text-muted">{r.waist} cm</span>}
            </span>
            <form action={deleteBodyweight}>
              <input type="hidden" name="id" value={r.id} />
              <button className="min-h-11 px-2 text-xs text-muted underline underline-offset-4">Delete</button>
            </form>
          </div>
        ))}
      </div>
    </Screen>
  );
}
