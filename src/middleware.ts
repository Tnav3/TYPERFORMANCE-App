import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { VIEW_AS_COOKIE } from "@/lib/view-as";

export async function middleware(request: NextRequest) {
  // "View as client" is read-only: refuse every save outside the coach screens.
  if (
    request.cookies.get(VIEW_AS_COOKIE)?.value &&
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    !request.nextUrl.pathname.startsWith("/coach")
  ) {
    return new NextResponse("Viewing as a client: changes are switched off. Tap 'Back to coach' to make changes.", { status: 403 });
  }
  return updateSession(request);
}

export const config = {
  // Skip static files, images, icons and the PWA manifest
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon|apple-icon|logo|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
