import { getCurrentSession } from "@/lib/auth/current-session";
import {
  getCurrentMembership,
  type CurrentMembership,
} from "@/lib/auth/current-membership";
import { requireCapability, type Capability } from "@/lib/auth/rbac";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";

/**
 * The one call every capability-gated route makes, replacing the bare
 * `getCurrentSession()` + `if (!session) throw ...` pattern every route from Phases 3–10
 * used. Collapses three failure modes a client must not be able to distinguish from each
 * other by response shape alone (no session; session's user no longer active; user has no
 * membership in this workspace) into the same `UnauthorizedError`/`ForbiddenError` pair
 * every other auth boundary in this codebase already uses.
 */
export async function requireCurrentMembership(): Promise<CurrentMembership> {
  const session = await getCurrentSession();
  if (!session) {
    throw new UnauthorizedError("Not authenticated");
  }

  const membership = await getCurrentMembership(session);
  if (!membership) {
    throw new ForbiddenError("You do not have access to this workspace");
  }

  return membership;
}

/**
 * Convenience wrapper for the common "must be logged in AND have this capability" check —
 * most write routes want exactly this in one line.
 */
export async function requireCurrentMembershipWithCapability(
  capability: Capability,
): Promise<CurrentMembership> {
  const membership = await requireCurrentMembership();
  requireCapability(membership.role, capability);
  return membership;
}
