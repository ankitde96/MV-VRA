import { dbConnect } from "@/lib/db/connect";
import { Vendor } from "@/lib/db/models/vendor";
import { Risk } from "@/lib/db/models/risk";
import { Assessment } from "@/lib/db/models/assessment";
import { AuditEvent } from "@/lib/db/models/audit-event";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

export interface DashboardSummary {
  vendor_count: number;
  tier1_count: number;
  unscored_count: number;
  open_risk_count: number;
  overdue_cap_count: number;
  assessments_awaiting_review: number;
  vendors_by_tier: {
    tier1: number;
    tier2: number;
    tier3: number;
    unscored: number;
  };
  vendors_by_business_unit: Array<{
    business_unit: string;
    tier1: number;
    tier2: number;
    tier3: number;
    unscored: number;
  }>;
  open_risks_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  risk_posture_trend: Array<{ week: string; opened: number; closed: number }>;
  attention_queue: Array<{
    kind: "overdue_cap" | "awaiting_review" | "unscored_vendor";
    id: string;
    label: string;
    href: string;
  }>;
  recent_activity: Array<{
    id: string;
    action: string;
    entity_type: string;
    at: string;
  }>;
}

/**
 * Single-workspace read-only aggregate for the internal dashboard (UI-REVAMP-PLAN.md
 * Phase 3) — no writer exists, this is the first reader of several of these shapes. Mirrors
 * `getExecutiveRollup()`'s aggregation pattern (`lib/services/executive-rollup.ts`) but
 * scoped to one `TenantContext`, not a per-membership loop, since the dashboard always
 * renders for the caller's *current* workspace only.
 */
export async function getDashboardSummary(
  ctx: TenantContext,
): Promise<DashboardSummary> {
  await dbConnect();
  const workspaceId = toObjectId(ctx.workspaceId);
  const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);

  const [
    tierCounts,
    tierByBusinessUnit,
    severityCounts,
    overdueCapCount,
    awaitingReviewCount,
    riskTrendRaw,
    unscoredVendors,
    overdueCapRisks,
    awaitingReviewAssessments,
    recentEvents,
  ] = await Promise.all([
    Vendor.aggregate([
      { $match: { workspace_id: workspaceId } },
      { $group: { _id: "$inherent_risk_tier", count: { $sum: 1 } } },
    ]),
    Vendor.aggregate([
      { $match: { workspace_id: workspaceId } },
      {
        $group: {
          _id: {
            business_unit: { $ifNull: ["$business_unit", "Unassigned"] },
            tier: "$inherent_risk_tier",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.business_unit": 1 } },
    ]),
    Risk.aggregate([
      { $match: { workspace_id: workspaceId, status: { $ne: "closed" } } },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]),
    Risk.countDocuments({
      workspace_id: workspaceId,
      "cap_tasks.status": "overdue",
    }),
    Assessment.countDocuments({
      workspace_id: workspaceId,
      status: "submitted",
    }),
    Risk.aggregate([
      {
        $match: {
          workspace_id: workspaceId,
          created_at: { $gte: twelveWeeksAgo },
        },
      },
      {
        $group: {
          _id: { $dateTrunc: { date: "$created_at", unit: "week" } },
          opened: { $sum: 1 },
          closed: { $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Vendor.find({ workspace_id: workspaceId, inherent_risk_tier: null })
      .select("legal_name")
      .limit(5)
      .lean(),
    Risk.find({ workspace_id: workspaceId, "cap_tasks.status": "overdue" })
      .select("title vendor_id")
      .limit(5)
      .lean(),
    Assessment.find({ workspace_id: workspaceId, status: "submitted" })
      .select("vendor_id template_version")
      .limit(5)
      .lean(),
    AuditEvent.find({ workspace_id: workspaceId })
      .sort({ at: -1 })
      .limit(8)
      .select("action entity_type at")
      .lean(),
  ]);

  const vendorsByTier = { tier1: 0, tier2: 0, tier3: 0, unscored: 0 };
  for (const row of tierCounts as { _id: number | null; count: number }[]) {
    if (row._id === 1) vendorsByTier.tier1 = row.count;
    else if (row._id === 2) vendorsByTier.tier2 = row.count;
    else if (row._id === 3) vendorsByTier.tier3 = row.count;
    else vendorsByTier.unscored += row.count;
  }

  const openRisksBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const row of severityCounts as { _id: string; count: number }[]) {
    if (row._id in openRisksBySeverity) {
      openRisksBySeverity[row._id as keyof typeof openRisksBySeverity] =
        row.count;
    }
  }

  const byBusinessUnit = new Map<
    string,
    DashboardSummary["vendors_by_business_unit"][number]
  >();
  for (const row of tierByBusinessUnit as Array<{
    _id: { business_unit: string; tier: number | null };
    count: number;
  }>) {
    const key = row._id.business_unit || "Unassigned";
    const item = byBusinessUnit.get(key) ?? {
      business_unit: key,
      tier1: 0,
      tier2: 0,
      tier3: 0,
      unscored: 0,
    };
    if (row._id.tier === 1) item.tier1 += row.count;
    else if (row._id.tier === 2) item.tier2 += row.count;
    else if (row._id.tier === 3) item.tier3 += row.count;
    else item.unscored += row.count;
    byBusinessUnit.set(key, item);
  }

  const riskPostureTrend = (
    riskTrendRaw as Array<{ _id: Date; opened: number; closed: number }>
  ).map((row) => ({
    week: row._id.toISOString().slice(0, 10),
    opened: row.opened,
    closed: row.closed,
  }));

  const attentionQueue: DashboardSummary["attention_queue"] = [
    ...overdueCapRisks.map((r) => ({
      kind: "overdue_cap" as const,
      id: r._id.toString(),
      label: r.title,
      href: `/risks`,
    })),
    ...awaitingReviewAssessments.map((a) => ({
      kind: "awaiting_review" as const,
      id: a._id.toString(),
      label: `Assessment v${a.template_version} awaiting review`,
      href: `/assessments/${a._id.toString()}`,
    })),
    ...unscoredVendors.map((v) => ({
      kind: "unscored_vendor" as const,
      id: v._id.toString(),
      label: v.legal_name,
      href: `/vendors/${v._id.toString()}`,
    })),
  ];

  const vendorCount =
    vendorsByTier.tier1 +
    vendorsByTier.tier2 +
    vendorsByTier.tier3 +
    vendorsByTier.unscored;
  const openRiskCount =
    openRisksBySeverity.critical +
    openRisksBySeverity.high +
    openRisksBySeverity.medium +
    openRisksBySeverity.low;

  return {
    vendor_count: vendorCount,
    tier1_count: vendorsByTier.tier1,
    unscored_count: vendorsByTier.unscored,
    open_risk_count: openRiskCount,
    overdue_cap_count: overdueCapCount,
    assessments_awaiting_review: awaitingReviewCount,
    vendors_by_tier: vendorsByTier,
    vendors_by_business_unit: [...byBusinessUnit.values()],
    open_risks_by_severity: openRisksBySeverity,
    risk_posture_trend: riskPostureTrend,
    attention_queue: attentionQueue.slice(0, 8),
    recent_activity: (
      recentEvents as Array<{
        _id: unknown;
        action: string;
        entity_type: string;
        at: Date;
      }>
    ).map((e) => ({
      id: String(e._id),
      action: e.action,
      entity_type: e.entity_type,
      at: e.at.toISOString(),
    })),
  };
}
