import { requireState } from "@/lib/session";
import { BackLink, Heading, Screen } from "@/components/ui";
import { CoachFileUpload } from "@/components/CoachFileUpload";
import { fmtBytes } from "@/lib/chat-media";
import { formatDate } from "@/lib/dates";
import { deleteCoachFile } from "./actions";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const { supabase } = await requireState(["coach"]);
  const { data } = await supabase.from("coach_files").select("id, name, mime, size, created_at").order("name");
  return (
    <Screen>
      <BackLink href="/coach/sequences" label="Onboarding sequences" />
      <Heading sub="Your PARQ, waiver, start-up guide and other handouts. Attach them to onboarding messages, and clients open them in one tap.">File library</Heading>
      <CoachFileUpload />
      <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
        {(data ?? []).map((f) => (
          <li key={f.id} className="flex items-center gap-3 p-3">
            <FileText size={20} className="shrink-0 text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{f.name}</span>
              <span className="block text-xs text-muted">{fmtBytes(f.size)} · added {formatDate(String(f.created_at).slice(0, 10))}</span>
            </span>
            <form action={deleteCoachFile}>
              <input type="hidden" name="id" value={f.id} />
              <button className="min-h-10 px-2 text-xs font-bold text-muted hover:text-brand">Delete</button>
            </form>
          </li>
        ))}
        {!data?.length && <li className="p-4 text-center text-sm text-muted">No files yet. Upload your PARQ, waiver and start-up guide.</li>}
      </ul>
    </Screen>
  );
}
