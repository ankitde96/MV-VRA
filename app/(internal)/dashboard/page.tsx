import {
  Building2,
  ShieldAlert,
  AlarmClockOff,
  ClipboardCheck,
  CalendarClock,
  Hourglass,
} from "lucide-react";
import { getCurrentSession } from "@/lib/auth/current-session";
import { getDashboardSummary } from "@/lib/services/dashboard";
import { getWorkspaceAnalytics } from "@/lib/services/analytics";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { KriListCard } from "@/components/layout/kri-list-card";
import { VendorsByBusinessUnitChart } from "@/components/charts/vendors-by-business-unit-chart";
import { RiskTrendChart } from "@/components/charts/risk-trend-chart";
import { RiskAgingChart } from "@/components/charts/risk-aging-chart";
import { ResidualExposureChart } from "@/components/charts/residual-exposure-chart";
import { AttentionQueue } from "@/components/layout/attention-queue";
import { RecentActivity } from "@/components/layout/recent-activity";

/**
 * UI Revamp Round 2 (`docs/UI-REVAMP-2-PLAN.md` Phase C, `DECISIONS.md` 028/029) — rebuilds
 * the Round 1 dashboard (six counters, two charts) into a KRI/KPI cockpit. `getDashboardSummary()`
 * still supplies the attention queue / recent activity / vendor-by-tier chart (unchanged
 * shape, still useful); everything net-new here comes from `getWorkspaceAnalytics()`
 * (`lib/services/analytics.ts`, Phase B). Glass hero + KRI tiles per DECISIONS.md 028 — the
 * risk-severity chart below stays on the locked flat palette, never glass.
 */
export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const [summary, analytics] = await Promise.all([
    getDashboardSummary({ workspaceId: session.workspaceId }),
    getWorkspaceAnalytics({ workspaceId: session.workspaceId }),
  ]);

  const tier1Pct = analytics.kri.tier1_concentration.percent;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Vendor risk posture at a glance."
      />

      {/* Core counters — unchanged from Round 1, still the fastest scan of headline state. */}
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
          hint={
            tier1Pct !== null
              ? `${tier1Pct.toFixed(0)}% of portfolio`
              : undefined
          }
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
          hint={
            analytics.kri.max_overdue_cap_days !== null
              ? `oldest ${analytics.kri.max_overdue_cap_days}d overdue`
              : undefined
          }
        />
        <StatCard
          label="Awaiting review"
          value={summary.assessments_awaiting_review}
          icon={<ClipboardCheck />}
          tone={summary.assessments_awaiting_review > 0 ? "medium" : "default"}
        />
      </div>

      {/* KRI row — the new signals docs/UI-REVAMP-2-PLAN.md's framework adds: risk-reduction
          effectiveness, reassessment overdue, portal stall. */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Avg. risk reduction"
          value={Math.round(
            analytics.kri.risk_reduction_effectiveness.avg_reduction_percent ??
              0,
          )}
          hint={
            analytics.kri.risk_reduction_effectiveness.avg_reduction_percent !==
            null
              ? `inherent → residual, ${analytics.kri.risk_reduction_effectiveness.sample_size} risks`
              : "No scored risks yet"
          }
          icon={<Hourglass />}
          tone="low"
        />
        <StatCard
          label="Reassessment overdue"
          value={analytics.kri.reassessment_overdue.length}
          icon={<CalendarClock />}
          tone={
            analytics.kri.reassessment_overdue.length > 0
              ? "critical"
              : "default"
          }
        />
        <StatCard
          label="Portal stalls"
          value={analytics.kri.portal_stall.length}
          icon={<Hourglass />}
          tone={analytics.kri.portal_stall.length > 0 ? "medium" : "default"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ResidualExposureChart data={analytics.kri.residual_exposure_trend} />
        <RiskAgingChart data={analytics.kri.risk_aging} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <RiskTrendChart data={summary.risk_posture_trend} />
        <VendorsByBusinessUnitChart data={summary.vendors_by_business_unit} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <KriListCard
          title="Reassessment overdue"
          emptyTitle="Nothing overdue"
          emptyDescription="Every vendor's next review is still within its tier's cadence window."
          icon={CalendarClock}
          items={analytics.kri.reassessment_overdue.map((v) => ({
            id: v.vendor_id,
            href: `/vendors/${v.vendor_id}`,
            label: v.vendor_name,
            badge: `${v.days_overdue}d overdue`,
            badgeTone: "critical",
          }))}
        />
        <KriListCard
          title="Portal stalls"
          emptyTitle="No stalled assessments"
          emptyDescription="Every sent assessment is either submitted or still within its response window."
          icon={Hourglass}
          items={analytics.kri.portal_stall.map((a) => ({
            id: a.assessment_id,
            href: `/vendors/${a.vendor_id}`,
            label: a.vendor_name,
            badge: a.past_due
              ? `${a.days_open}d, past due`
              : `${a.days_open}d open`,
            badgeTone: a.past_due ? "high" : "medium",
          }))}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AttentionQueue items={summary.attention_queue} />
        <RecentActivity events={summary.recent_activity} />
      </div>
    </div>
  );
}
