import { env } from "@/lib/env";

/**
 * Name is the actual isolation boundary between this and the future vendor-portal cookie
 * (Phase 6) — FLOW.md F2 requires a portal session can never satisfy an internal check, and
 * vice versa. Middleware only ever reads this exact cookie name for internal routes; Phase
 * 6 will introduce its own distinctly-named cookie read by its own middleware. `path: '/'`
 * is intentional, not an oversight — Next.js route groups like `(internal)`/`(portal)` don't
 * add a URL segment, so a path-based split isn't meaningful here; the cookie name is what
 * carries the guarantee.
 */
export const INTERNAL_SESSION_COOKIE = "mvvra_internal_session";

export const internalSessionCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
