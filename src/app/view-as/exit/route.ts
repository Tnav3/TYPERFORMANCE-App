import { NextResponse, type NextRequest } from "next/server";
import { VIEW_AS_COOKIE, VIEW_AS_NAME, VIEW_AS_UUID } from "@/lib/view-as";

// Back to the coach view, on the client you were looking at.
export async function GET(req: NextRequest) {
  const id = req.cookies.get(VIEW_AS_COOKIE)?.value;
  const res = NextResponse.redirect(new URL(id && VIEW_AS_UUID.test(id) ? `/coach/athlete/${id}` : "/coach", req.url));
  res.cookies.delete(VIEW_AS_COOKIE);
  res.cookies.delete(VIEW_AS_NAME);
  return res;
}
