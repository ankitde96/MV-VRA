import { env } from "@/lib/env";

/**
 * Distinct name from `INTERNAL_SESSION_COOKIE` (lib/auth/session-cookie.ts) —
 * `FLOW.md` F2 gap (b). The name is the guarantee: proxy.ts reads this exact cookie only
 * on /portal and /api/portal paths, and the internal branch never reads it at all.
 * `path: '/'` (same as the internal cookie) is required, not an oversight — the portal's
 * pages live under `/portal` but its API routes live under `/api/portal`, a different
 * prefix, so a cookie scoped to `/portal` would never reach the API.
 */
export const PORTAL_SESSION_COOKIE = "mvvra_portal_session";

export const portalSessionCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
