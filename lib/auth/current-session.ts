import { cookies } from "next/headers";
import { INTERNAL_SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { verifySessionToken, type SessionPayload } from "@/lib/auth/session";

/**
 * Server Components / route handlers only — reads the session from the request's own
 * cookies via next/headers. Never trust a client-supplied workspaceId; this is the one
 * place a Server Component should get it from (CONSTRAINTS.md #8-adjacent: the same
 * "derive scope from the session, never a parameter" discipline FLOW.md F2 requires of the
 * vendor portal applies here too).
 */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(INTERNAL_SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}
