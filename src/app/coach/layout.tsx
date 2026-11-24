import { CoachNav } from "@/components/CoachNav";
import { createClient } from "@/lib/supabase/server";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { count } = user
    ? await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .neq("sender_id", user.id)
        .is("read_at", null)
    : { count: 0 };
  return (
    <>
      <CoachNav unread={count ?? 0} />
      <div className="pb-20 lg:pb-0 lg:pl-64">{children}</div>
    </>
  );
}
