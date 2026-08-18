import { getCurrentSession } from "@/lib/auth/current-session";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { listWorkspaces } from "@/lib/services/admin-workspaces";
import { AdminWorkspacesClient } from "@/components/admin/admin-workspaces-client";

export default async function AdminWorkspacesPage() {
  const session = await getCurrentSession();
  if (!session) return null;
  await requireSuperAdmin();
  return (
    <AdminWorkspacesClient
      initialWorkspaces={await listWorkspaces()}
      currentWorkspaceId={session.workspaceId}
    />
  );
}
