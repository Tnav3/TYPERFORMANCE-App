import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_COOKIE, VIEW_AS_NAME, VIEW_AS_UUID } from "@/lib/view-as";

// Coach → see this client's app. Read-only until they tap back.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, status").eq("id", user.id).maybeSingle() : { data: null };
  if (me?.role !== "coach" || me.status !== "active" || !VIEW_AS_UUID.test(id)) return NextResponse.redirect(new URL("/", req.url));
  const { data: client } = await supabase.from("profiles").select("id, full_name, email").eq("id", id).eq("role", "athlete").maybeSingle();
  if (!client) return NextResponse.redirect(new URL("/coach/clients", req.url));
  const res = NextResponse.redirect(new URL("/athlete", req.url));
  const opts = { path: "/", sameSite: "lax" as const, secure: true, maxAge: 60 * 60 * 2 };
  res.cookies.set(VIEW_AS_COOKIE, client.id, { ...opts, httpOnly: true });
  res.cookies.set(VIEW_AS_NAME, encodeURIComponent(client.full_name ?? client.email), opts);
  return res;
}
