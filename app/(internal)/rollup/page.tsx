import { BarChart3 } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/current-session";
import { getExecutiveRollup } from "@/lib/services/executive-rollup";
import { getRollupAnalyticsSummary } from "@/lib/services/analytics";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/layout/empty-state";
import { RollupWorkspaceCard } from "@/components/rollup/rollup-workspace-card";
import { TierComparisonChart } from "@/components/charts/tier-comparison-chart";
import { CapAgeBucketChart } from "@/components/charts/cap-age-bucket-chart";

/**
 * `FLOW.md` F6 — the consolidated executive roll-up. `getExecutiveRollup()` does the actual
 * per-workspace authorization; this page only renders whatever it returns, and shows the
 * "N of M workspaces" line explicitly so a `viewer`-role membership in a sibling workspace
 * visibly does *not* silently inflate the numbers.
 *
 * UI Revamp Round 2, Phase D (`docs/UI-REVAMP-2-PLAN.md`, `DECISIONS.md` 028/029) adds the
 * two DESIGN-SYSTEM.md §5 charts Round 1 never built — a grouped-bar tier comparison and a
 * CAP age-bucket bar — on top of `getRollupAnalyticsSummary()` (`lib/services/analytics.ts`),
 * which reuses `getExecutiveRollup()`'s own per-membership authorization loop rather than a
 * single top-level check (`DECISIONS.md` 024). The per-workspace detail cards below are
 * unchanged Round 1 functionality, just re-skinned glass.
 */
export default async function RollupPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const [result, analyticsSummary] = await Promise.all([
    getExecutiveRollup(session.userId),
    getRollupAnalyticsSummary(session.userId),
  ]);

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Executive Roll-up"
        description={`Aggregated posture across every workspace you hold a role authorized to view it in — ${result.authorized_workspace_count} of ${result.total_membership_count} memberships qualify.`}
        aurora
      />

      {result.workspaces.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No roll-up access"
          description="No workspace you belong to grants you roll-up access (requires the admin or risk analyst role)."
        />
      ) : (
        <>
          {analyticsSummary.workspaces.length > 1 ? (
            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              <TierComparisonChart workspaces={analyticsSummary.workspaces} />
              <CapAgeBucketChart workspaces={analyticsSummary.workspaces} />
            </div>
          ) : null}

          <div className="space-y-4">
            {result.workspaces.map((w) => (
              <RollupWorkspaceCard key={w.workspace_id} workspace={w} glass />
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}
