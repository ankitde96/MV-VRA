import { NextResponse, type NextRequest } from "next/server";
import { INTERNAL_SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { verifySessionToken } from "@/lib/auth/session";
import { PORTAL_SESSION_COOKIE } from "@/lib/auth/portal-session-cookie";
import { verifyPortalSessionToken } from "@/lib/auth/portal-session";

/**
 * Fail-closed by construction: every request needs a valid internal session unless its path
 * is explicitly listed here. A new internal page added in a later phase is protected by
 * default — nobody has to remember to add it to a protected-routes list, which is exactly
 * the kind of omission CONSTRAINTS.md #8 warns about for tenant scoping and applies equally
 * well here.
 */
const PUBLIC_PATHS = new Set(["/", "/login"]);
const PUBLIC_API_PATHS = new Set(["/api/auth/login", "/api/auth/logout"]);

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname);
}

/**
 * Phase 6, `FLOW.md` F2 gap (b): the portal gets its own fail-closed branch, entirely
 * independent of the internal one above — different path prefix, different cookie, different
 * verify function. There is no shared code path where an internal session could satisfy a
 * portal check or vice versa; they don't call into each other at all.
 */
const PORTAL_PUBLIC_PATHS = new Set(["/portal/login"]);
const PORTAL_PUBLIC_API_PATHS = new Set([
  "/api/portal/auth/otp/request",
  "/api/portal/auth/otp/verify",
]);

function isPortalPath(pathname: string): boolean {
  return pathname.startsWith("/portal") || pathname.startsWith("/api/portal");
}

function isPortalPublic(pathname: string): boolean {
  return (
    PORTAL_PUBLIC_PATHS.has(pathname) || PORTAL_PUBLIC_API_PATHS.has(pathname)
  );
}

async function handlePortalRequest(
  request: NextRequest,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (isPortalPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(PORTAL_SESSION_COOKIE)?.value;
  const session = await verifyPortalSessionToken(token);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/portal/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPortalPath(pathname)) {
    return handlePortalRequest(request);
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(INTERNAL_SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Every path except Next.js internals and static assets. The allowlist that actually
    // matters lives in isPublic() above, in one place, not split across this matcher too.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
