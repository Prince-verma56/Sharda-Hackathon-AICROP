import { NextResponse, type NextRequest } from "next/server";
import { loginUrlForProtectedPath } from "@/lib/auth/redirects";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

/**
 * CropAI uses its own phone + OTP login (no external auth provider, no hosted login portal).
 *
 * Optimistic check only: a protected page without a session cookie goes to our /login page on
 * this domain, e.g. /farmer/scan -> /login?role=farmer&next=/farmer/scan.
 * The secure checks — session validity, account status, roles, ownership — run server-side in
 * server/auth/dal.ts on every page, action and API call. API routes return 401 themselves and
 * also accept `Authorization: Bearer <session token>` from the mobile app.
 */
export function proxy(req: NextRequest) {
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  return NextResponse.redirect(new URL(loginUrlForProtectedPath(req.nextUrl.pathname), req.url));
}

export const config = {
  matcher: ["/farmer/:path*", "/volunteer/:path*", "/admin/:path*", "/dev/:path*", "/workspaces/:path*", "/auth/continue"],
};
