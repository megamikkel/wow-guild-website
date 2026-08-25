import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate: redirect anonymous visitors away from member/officer
 * areas. This is UX only — real authorization (role checks) happens
 * server-side in the layouts, pages and server actions via requireRole().
 */
export function middleware(request: NextRequest) {
  const hasSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
