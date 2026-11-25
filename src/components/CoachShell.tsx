// Coach sidebar + content offset. Used by /coach and by the coach's own tools that live
// outside /coach (1RM, MAS, log my own training) so they don't drop into the phone layout.
import { CoachNav } from "@/components/CoachNav";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_COOKIE } from "@/lib/view-as";

export async function CoachShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { count } = user
    ? await supabase.from("messages").select("id", { count: "exact", head: true }).neq("sender_id", user.id).is("read_at", null)
    : { count: 0 };
  const { count: notes } = user
    ? await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null)
    : { count: 0 };
  return (
    <>
      <CoachNav unread={count ?? 0} notes={notes ?? 0} />
      <div className="pb-20 lg:pb-0 lg:pl-64">{children}</div>
    </>
  );
}

/** Wrap in the coach shell only when the signed-in user is the coach (and not viewing as a client). */
export async function CoachShellIfCoach({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <>{children}</>;
  if ((await cookies()).get(VIEW_AS_COOKIE)?.value) return <>{children}</>;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (data?.role !== "coach") return <>{children}</>;
  return <CoachShell>{children}</CoachShell>;
}
