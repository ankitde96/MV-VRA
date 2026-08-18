import { dbConnect } from "@/lib/db/connect";
import { User } from "@/lib/db/models/user";
import type { SessionPayload } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/rbac";

export interface CurrentMembership {
  userId: string;
  workspaceId: string;
  role: Role;
}

/**
 * Deliberately re-queries the database on every call rather than trusting a `role` embedded
 * in the signed session cookie. The cookie's TTL is 8 hours (`lib/auth/session.ts`) — if an
 * admin demotes or disables a user mid-session, a cached role would keep granting the old
 * capability set for up to 8 hours. Re-deriving it here means a role change (or a
 * memberships change: e.g. workspace access revoked) takes effect on the very next request,
 * the same "never trust a cached scope" discipline `CONSTRAINTS.md` #8 already requires for
 * `workspace_id` itself.
 *
 * Returns null if the user no longer exists, is disabled, or no longer has a membership in
 * the session's `workspaceId` — all three collapse to "not authorized here," same as a
 * missing session, so callers should treat null identically to "not logged in."
 */
export async function getCurrentMembership(
  session: SessionPayload,
): Promise<CurrentMembership | null> {
  await dbConnect();
  const user = await User.findOne({
    _id: session.userId,
    status: "active",
  }).lean();
  if (!user) return null;

  const membership = user.memberships.find(
    (m) => m.workspace_id.toString() === session.workspaceId,
  );
  if (!membership) return null;

  return {
    userId: user._id.toString(),
    workspaceId: membership.workspace_id.toString(),
    role: membership.role as Role,
  };
}
