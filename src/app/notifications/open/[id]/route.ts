// Opening a notification from the home screen: mark it read, then go where it points.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let to = "/notifications";
  if (UUID.test(id)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("open_notification", { p_id: id });
    if (typeof data === "string" && data.startsWith("/") && !data.startsWith("//")) to = data;
  }
  return NextResponse.redirect(new URL(to, req.url));
}
