import { BarChart3 } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/current-session";
import { getExecutiveRollup } from "@/lib/services/executive-rollup";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/layout/empty-state";
import { RollupWorkspaceCard } from "@/components/rollup/rollup-workspace-card";

/**
 * `FLOW.md` F6 — the consolidated executive roll-up. `getExecutiveRollup()` does the actual
 * per-workspace authorization; this page only renders whatever it returns, and shows the
 * "N of M workspaces" line explicitly so a `viewer`-role membership in a sibling workspace
 * visibly does *not* silently inflate the numbers.
 */
export default async function RollupPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const result = await getExecutiveRollup(session.userId);

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Executive Roll-up"
        description={`Aggregated posture across every workspace you hold a role authorized to view it in — ${result.authorized_workspace_count} of ${result.total_membership_count} memberships qualify.`}
      />

      {result.workspaces.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No roll-up access"
          description="No workspace you belong to grants you roll-up access (requires the admin or risk analyst role)."
        />
      ) : (
        <div className="space-y-4">
          {result.workspaces.map((w) => (
            <RollupWorkspaceCard key={w.workspace_id} workspace={w} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
