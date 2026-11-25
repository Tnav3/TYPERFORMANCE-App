import { requireState } from "@/lib/session";
import { Alert, Card, Heading, Screen } from "@/components/ui";
import { quoteOfDay } from "@/lib/quotes";
import { todayISO } from "@/lib/dates";
import { addQuote, deleteQuote, toggleQuote } from "./actions";

export const dynamic = "force-dynamic";
const input = "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-text placeholder:text-muted/60 focus:border-brand focus:outline-none";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireState(["coach"]);
  const { error } = await searchParams;
  const { data } = await supabase.from("quotes").select("*").order("created_at");
  const quotes = data ?? [];
  const today = quoteOfDay(quotes.filter((q) => q.active), todayISO());
  return (
    <Screen>
      <Heading sub="One shows on every client's Home each day. Only add quotes you know the source of, or write your own.">Daily quotes</Heading>
      {error && <Alert>{error}</Alert>}
      <Card className="mb-4">
        <form action={addQuote} className="space-y-2">
          <textarea name="body" rows={2} maxLength={240} required placeholder="Your line" className={`${input} py-2`} />
          <input name="author" maxLength={80} defaultValue="TYPERFORMANCE" placeholder="Who said it" className={input} />
          <button className="min-h-11 w-full rounded-xl bg-brand font-bold text-white">Add quote</button>
        </form>
      </Card>
      <div className="space-y-2">
        {quotes.map((q) => (
          <div key={q.id} className={`rounded-xl border p-3 ${q.id === today?.id ? "border-brand" : "border-line"} ${q.active ? "bg-surface" : "bg-surface opacity-50"}`}>
            {q.id === today?.id && <p className="text-xs font-bold uppercase text-brand">Showing today</p>}
            <p>{q.body}</p>
            {q.author && <p className="text-xs text-muted">{q.author}</p>}
            <div className="mt-2 flex gap-4 text-sm">
              <form action={toggleQuote}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="active" value={String(q.active)} /><button className="text-muted underline">{q.active ? "Switch off" : "Switch on"}</button></form>
              <form action={deleteQuote}><input type="hidden" name="id" value={q.id} /><button className="text-red-400">Delete</button></form>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}
