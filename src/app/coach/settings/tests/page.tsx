import { requireState } from "@/lib/session";
import { getTestDefs } from "@/lib/test-data";
import { youtubeId } from "@/lib/testing";
import { updateTestDefinition } from "@/app/tests/actions";
import { Alert, BackLink, Card, Heading, Screen } from "@/components/ui";

const input =
  "w-full rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export default async function TestSettings({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { supabase } = await requireState(["coach"]);
  const { error, saved } = await searchParams;
  const defs = (await getTestDefs(supabase)).filter((d) => d.mode === "field");

  return (
    <Screen wide>
      <BackLink href="/coach/settings" label="Settings" />
      <Heading sub="Paste your YouTube link and edit the written steps. Athletes see both above the result form.">
        Field test videos & instructions
      </Heading>
      {error && <Alert>{error}</Alert>}

      <div className="space-y-4">
        {defs.map((d) => (
          <Card key={d.key} className="!p-4">
            <form
              action={updateTestDefinition}
              id={d.key}
              className="scroll-mt-6"
            >
              <input type="hidden" name="key" value={d.key} />
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-extrabold">{d.name}</h2>
                {saved === d.key && (
                  <span className="text-xs text-ok">Saved</span>
                )}
                {!saved && !d.youtube_url && (
                  <span className="text-xs text-warn">No video yet</span>
                )}
              </div>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs text-muted">
                  YouTube link
                </span>
                <input
                  name="youtube_url"
                  defaultValue={d.youtube_url ?? ""}
                  placeholder="https://youtu.be/…"
                  className={`${input} min-h-11`}
                />
                {d.youtube_url && !youtubeId(d.youtube_url) && (
                  <span className="text-xs text-brand">
                    Not a valid YouTube link
                  </span>
                )}
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs text-muted">
                  Written instructions (draft, edit freely)
                </span>
                <textarea
                  name="instructions"
                  defaultValue={d.instructions ?? ""}
                  rows={6}
                  maxLength={3000}
                  className={`${input} py-2 text-sm`}
                />
              </label>
              <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-extrabold uppercase text-white">
                Save
              </button>
            </form>
          </Card>
        ))}
      </div>
    </Screen>
  );
}
