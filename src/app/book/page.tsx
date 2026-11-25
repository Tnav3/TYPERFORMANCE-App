import { requireState } from "@/lib/session";
import { BackLink, Heading, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

// Client books their catch-up or session inside the app (Calendly embed), with a fallback link.
export default async function BookPage() {
  const { supabase, profile } = await requireState(["athlete"]);
  const key = (profile as unknown as { plan_key: string | null }).plan_key;
  const { data: plan } = key ? await supabase.from("coaching_plans").select("name, booking_label, booking_url").eq("key", key).maybeSingle() : { data: null };
  const url = plan?.booking_url ?? null;
  const embed = url && /^https:\/\/calendly\.com\//.test(url) ? `${url}${url.includes("?") ? "&" : "?"}hide_gdpr_banner=1&background_color=111111&text_color=ffffff&primary_color=e10600` : url;
  return (
    <Screen>
      <BackLink href="/athlete" label="Home" />
      <Heading sub={plan ? `Your plan: ${plan.name}` : undefined}>{plan?.booking_label ?? "Book a session"}</Heading>
      {!url ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-muted">Booking isn&apos;t set up for your plan yet. Message your coach to book.</p>
      ) : (
        <>
          <iframe src={embed!} title="Booking calendar" className="h-[75dvh] w-full rounded-2xl border border-line bg-white" />
          <a href={url} target="_blank" rel="noreferrer" className="mt-3 block text-center text-sm font-bold text-muted underline underline-offset-4">
            Calendar not loading? Open it in your browser
          </a>
        </>
      )}
    </Screen>
  );
}
