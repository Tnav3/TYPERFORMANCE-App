import { requireState } from "@/lib/session";
import { Heading, Screen } from "@/components/ui";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";
const LABEL: Record<string, string> = { new: "New", planned: "Planned", fixed: "Fixed", wont_fix: "Won't fix" };

async function setStatus(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  if (/^[0-9a-f-]{36}$/.test(id) && status in LABEL) await supabase.from("feedback").update({ status }).eq("id", id);
  revalidatePath("/coach/feedback");
}

export default async function FeedbackInbox() {
  const { supabase } = await requireState(["coach"]);
  const { data } = await supabase
    .from("feedback")
    .select("id, kind, message, page, app_version, device, status, created_at, profiles(full_name, email, beta)")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as {
    id: string; kind: string; message: string; page: string | null; app_version: string | null; device: string | null; status: string; created_at: string;
    profiles: { full_name: string | null; email: string; beta: boolean } | null;
  }[];
  return (
    <Screen wide>
      <Heading sub="Problems and ideas sent from inside the app, newest first.">Beta feedback</Heading>
      <ul className="space-y-2">
        {rows.map((f) => (
          <li key={f.id} className={`rounded-2xl border bg-surface p-4 ${f.status === "new" ? "border-brand/60" : "border-line"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">
                {f.kind === "bug" ? "🐞 Problem" : f.kind === "idea" ? "💡 Idea" : "💬 Other"} · {f.profiles?.full_name ?? f.profiles?.email}
                {f.profiles?.beta && <span className="ml-1 rounded bg-brand/15 px-1.5 text-xs text-brand">BETA</span>}
              </p>
              <form action={setStatus} className="flex items-center gap-1">
                <input type="hidden" name="id" value={f.id} />
                <select name="status" defaultValue={f.status} className="min-h-9 rounded-lg border border-line bg-surface-2 px-2 text-xs">
                  {Object.entries(LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <button className="min-h-9 rounded-lg border border-line px-2 text-xs font-bold">Set</button>
              </form>
            </div>
            <p className="mt-2 whitespace-pre-wrap">{f.message}</p>
            <p className="mt-2 text-xs text-muted">
              {formatDate(f.created_at.slice(0, 10))} · {f.page ?? "?"} · v{f.app_version ?? "?"}
              {f.device && <span className="block truncate">{f.device}</span>}
            </p>
          </li>
        ))}
        {!rows.length && <li className="rounded-2xl border border-line bg-surface p-4 text-center text-muted">Nothing yet.</li>}
      </ul>
    </Screen>
  );
}
