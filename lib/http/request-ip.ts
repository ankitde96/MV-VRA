import type { NextRequest } from "next/server";

/**
 * `NextRequest.ip` was removed in Next.js 15 — there is no built-in accessor anymore
 * without an external package (`@vercel/functions`, not something this project depends
 * on). `x-forwarded-for` is the standard proxy header; local dev has none, so this
 * legitimately returns `null` outside of a deployment behind a proxy that sets it.
 */
export function getRequestIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? null;
}
