import { cookies } from "next/headers";
import { PORTAL_SESSION_COOKIE } from "@/lib/auth/portal-session-cookie";
import {
  verifyPortalSessionToken,
  type PortalSessionPayload,
} from "@/lib/auth/portal-session";

/**
 * Server Components / route handlers only, mirroring lib/auth/current-session.ts. Every
 * portal route re-derives `vendorId`/`workspaceId` from here — never from a URL or body
 * parameter (`FLOW.md` F2 gap b) — even though proxy.ts has already checked the cookie
 * exists; this is the same "route handlers don't trust middleware's decision, they
 * re-verify" discipline the internal routes already follow.
 */
export async function getCurrentPortalSession(): Promise<PortalSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;
  return verifyPortalSessionToken(token);
}
