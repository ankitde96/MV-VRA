import { dbConnect } from "@/lib/db/connect";
import { User } from "@/lib/db/models/user";
import { Workspace } from "@/lib/db/models/workspace";
import { ForbiddenError } from "@/lib/errors";
import type { Role } from "@/lib/auth/rbac";
import type { SessionPayload } from "@/lib/auth/session";

export interface MembershipListItem {
  workspace_id: string;
  workspace_name: string;
  role: Role;
}

/**
 * Powers the workspace-switcher UI (`components/workspace-switcher.tsx`) — every workspace
 * the logged-in user actually has a membership in, not every workspace that exists. Reads
 * straight from `User.memberships`, the same source `switchWorkspace()` below checks
 * against, so the switcher can never offer a workspace the switch itself would then refuse.
 */
export async function listMembershipsForUser(
  userId: string,
): Promise<MembershipListItem[]> {
  await dbConnect();
  const user = await User.findOne({ _id: userId, status: "active" }).lean();
  if (!user) return [];

  const workspaceIds = user.memberships.map((m) => m.workspace_id);
  const workspaces = await Workspace.find({
    _id: { $in: workspaceIds },
  }).lean();
  const nameById = new Map(
    workspaces.map((w) => [w._id.toString(), w.entity_name]),
  );

  return user.memberships.map((m) => ({
    workspace_id: m.workspace_id.toString(),
    workspace_name:
      nameById.get(m.workspace_id.toString()) ?? "Unknown workspace",
    role: m.role as Role,
  }));
}

/**
 * The only place a session's `workspaceId` legitimately changes after login. Re-checks
 * membership against the database (never trusts the caller's claim that they belong to the
 * target workspace) — the same "re-derive scope, don't trust a parameter" rule
 * `CONSTRAINTS.md` #8 already applies to every tenant-scoped query, extended here to the
 * session itself. Returns the new `SessionPayload` for the route to re-sign into a cookie;
 * this function never touches cookies directly, keeping it testable without `next/headers`.
 */
export async function switchWorkspace(
  session: SessionPayload,
  targetWorkspaceId: string,
): Promise<SessionPayload> {
  await dbConnect();
  const user = await User.findOne({
    _id: session.userId,
    status: "active",
  }).lean();
  if (!user) {
    throw new ForbiddenError("User account no longer active");
  }

  const membership = user.memberships.find(
    (m) => m.workspace_id.toString() === targetWorkspaceId,
  );
  if (!membership) {
    throw new ForbiddenError("You do not have a membership in that workspace");
  }

  return { userId: session.userId, workspaceId: targetWorkspaceId };
}
