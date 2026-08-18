import { getCurrentSession } from "@/lib/auth/current-session";
import { getCurrentMembership } from "@/lib/auth/current-membership";
import { roleHasCapability } from "@/lib/auth/rbac";
import { listWorkspaceUsers } from "@/lib/services/admin-users";
import { AdminUsersClient } from "@/components/admin/admin-users-client";

/**
 * Server Component — checks `workspace.manage_users` itself (not the API route's `throw`,
 * since a page rendering an error boundary is a worse experience than a plain "not
 * authorized" message) before ever calling `listWorkspaceUsers()`.
 */
export default async function AdminUsersPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const membership = await getCurrentMembership(session);
  if (
    !membership ||
    !roleHasCapability(membership.role, "workspace.manage_users")
  ) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-lg font-semibold">Not authorized</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Only an admin can manage users in this workspace.
        </p>
      </div>
    );
  }

  const users = await listWorkspaceUsers({
    workspaceId: membership.workspaceId,
  });

  return (
    <AdminUsersClient initialUsers={users} currentUserId={membership.userId} />
  );
}
