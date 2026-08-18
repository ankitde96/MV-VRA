import {
  Building2,
  ShieldAlert,
  AlarmClockOff,
  ClipboardCheck,
} from "lucide-react";
import { getCurrentSession } from "@/lib/auth/current-session";
import { getDashboardSummary } from "@/lib/services/dashboard";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { TierDistributionChart } from "@/components/charts/tier-distribution-chart";
import { RiskTrendChart } from "@/components/charts/risk-trend-chart";
import { AttentionQueue } from "@/components/layout/attention-queue";
import { RecentActivity } from "@/components/layout/recent-activity";

/**
 * Replaces the Phase 2 placeholder (UI-REVAMP-PLAN.md Phase 3). All data comes from
 * `getDashboardSummary()` (lib/services/dashboard.ts, new this phase) — a single-workspace
 * read aggregate mirroring `getExecutiveRollup()`'s query shape but scoped to the caller's
 * current `session.workspaceId`, the same tenant-scoping discipline every other page here
 * follows.
 */
export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const summary = await getDashboardSummary({
    workspaceId: session.workspaceId,
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Vendor risk posture at a glance."
        gradient
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Vendors"
          value={summary.vendor_count}
          icon={<Building2 />}
        />
        <StatCard
          label="Tier 1"
          value={summary.tier1_count}
          icon={<ShieldAlert />}
          tone={summary.tier1_count > 0 ? "critical" : "default"}
        />
        <StatCard
          label="Open risks"
          value={summary.open_risk_count}
          icon={<ShieldAlert />}
          tone={summary.open_risk_count > 0 ? "high" : "default"}
        />
        <StatCard
          label="Overdue CAPs"
          value={summary.overdue_cap_count}
          icon={<AlarmClockOff />}
          tone={summary.overdue_cap_count > 0 ? "critical" : "default"}
        />
        <StatCard
          label="Awaiting review"
          value={summary.assessments_awaiting_review}
          icon={<ClipboardCheck />}
          tone={summary.assessments_awaiting_review > 0 ? "medium" : "default"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <RiskTrendChart data={summary.risk_posture_trend} />
        <TierDistributionChart data={summary.vendors_by_tier} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AttentionQueue items={summary.attention_queue} />
        <RecentActivity events={summary.recent_activity} />
      </div>
    </div>
  );
}
