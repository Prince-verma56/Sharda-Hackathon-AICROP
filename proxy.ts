import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

/**
 * Auth provider is selected by AUTH_PROVIDER (template convention).
 * - "credentials" (default): CropAI first-party sessions (farmer OTP / staff password + MFA).
 * - "clerk": the template's Clerk middleware (requires Clerk keys).
 *
 * The checks below are OPTIMISTIC (cookie presence only, no DB access) as recommended for
 * Proxy; every page, action and API re-validates the session in server/auth/dal.ts.
 */
const useClerk = (process.env.AUTH_PROVIDER || "credentials").toLowerCase() === "clerk";
const clerk = useClerk ? clerkMiddleware() : null;

const FARMER_PUBLIC = ["/farmer/login", "/farmer/verify"];
const ADMIN_PUBLIC = ["/admin/login", "/admin/invite"];

function redirectTo(req: NextRequest, path: string) {
  const url = new URL(path, req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/farmer")) {
    const signedIn = Boolean(req.cookies.get("cropai_farmer")?.value);
    const isPublic = FARMER_PUBLIC.some((p) => pathname.startsWith(p));
    if (!signedIn && !isPublic) return redirectTo(req, "/farmer/login");
  }

  if (pathname.startsWith("/admin")) {
    const signedIn = Boolean(req.cookies.get("cropai_staff")?.value);
    const isPublic = ADMIN_PUBLIC.some((p) => pathname.startsWith(p));
    if (!signedIn && !isPublic) return redirectTo(req, "/admin/login");
  }

  if (clerk) return clerk(req, event);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Always run for Clerk-specific frontend API routes
    "/__clerk/(.*)",
  ],
};
