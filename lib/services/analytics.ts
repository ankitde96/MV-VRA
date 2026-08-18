import { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Vendor } from "@/lib/db/models/vendor";
import { Risk } from "@/lib/db/models/risk";
import { Assessment } from "@/lib/db/models/assessment";
import { Engagement } from "@/lib/db/models/engagement";
import { Offboarding } from "@/lib/db/models/offboarding";
import { Response } from "@/lib/db/models/response";
import { User } from "@/lib/db/models/user";
import { Workspace } from "@/lib/db/models/workspace";
import { roleHasCapability, type Role } from "@/lib/auth/rbac";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

/**
 * KRI/KPI aggregation layer for UI Revamp Round 2 (`docs/UI-REVAMP-2-PLAN.md`,
 * `DECISIONS.md` 028/029). Splits deliberately: KRIs measure risk *carried* (exposure,
 * early warning); KPIs measure how well the program *runs* (efficiency). Every field that
 * depends on the Round-2 additive timestamps (`Assessment.due_date`/`next_review_due`,
 * `Risk.closed_at`) is `null`-safe by construction — a record written before this phase
 * (or one that never reached the step that stamps the field) is *excluded* from the
 * relevant average/rate, never defaulted to another date. This mirrors the project's
 * existing fail-loud scoring rule (`DATA-MODEL.md` §4) rather than inventing a new one.
 *
 * Not implemented here (scoped out of Phase B, see `docs/UI-REVAMP-2-PLAN.md`): the
 * framework's "evidence gap rate" is approximated (answered-but-no-evidence, not
 * "questions that actually require evidence" — the schema has no such flag to join
 * against) and is labelled as an approximation in its own field name; "cross-workspace
 * share reuse" is left for a later pass, not fabricated with a shallow proxy.
 */

const RISK_SEVERITIES = ["critical", "high", "medium", "low"] as const;
type RiskSeverityKey = (typeof RISK_SEVERITIES)[number];

export interface RiskAgingBucket {
  bucket: "0-30" | "31-60" | "61-90" | "90+";
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface WorkspaceAnalytics {
  kri: {
    tier1_concentration: { count: number; percent: number | null };
    unscored_vendor_count: number;
    open_risk_by_severity: Record<RiskSeverityKey, number>;
    risk_aging: RiskAgingBucket[];
    residual_exposure_trend: Array<{ week: string; total_residual: number }>;
    risk_reduction_effectiveness: {
      avg_inherent: number | null;
      avg_residual: number | null;
      avg_reduction_percent: number | null;
      sample_size: number;
    };
    sensitive_data_exposure_count: number;
    single_source_tier1_count: number;
    overdue_cap_count: number;
    max_overdue_cap_days: number | null;
    reassessment_overdue: Array<{
      vendor_id: string;
      vendor_name: string;
      next_review_due: string;
      days_overdue: number;
    }>;
    portal_stall: Array<{
      assessment_id: string;
      vendor_id: string;
      vendor_name: string;
      days_open: number;
      past_due: boolean;
    }>;
    offboarding_hygiene_gap_count: number;
    evidence_gap_rate_approx: number | null;
  };
  kpi: {
    cycle_time_days: {
      assign_to_submit_avg: number | null;
      submit_to_review_avg: number | null;
      end_to_end_avg: number | null;
      sample_size: number;
    };
    on_time_completion_rate: number | null;
    mttr_days_by_severity: Record<RiskSeverityKey, number | null>;
    cap_closure_rate: number | null;
    risk_closure_trend: Array<{ week: string; opened: number; closed: number }>;
    assessment_throughput: Array<{ week: string; count: number }>;
    review_coverage_percent: number | null;
  };
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Single-workspace KRI/KPI aggregate — mirrors `getDashboardSummary()`'s `Promise.all`
 * aggregation pattern (`lib/services/dashboard.ts`), scoped to the caller's current
 * workspace. Consumed by the Phase C dashboard rebuild and the Phase E per-vendor
 * scorecard (vendor-scoped queries are the same shape, just with an added `vendor_id`
 * match — no separate function needed for that).
 */
export async function getWorkspaceAnalytics(
  ctx: TenantContext,
): Promise<WorkspaceAnalytics> {
  await dbConnect();
  const workspaceId = toObjectId(ctx.workspaceId);
  const now = new Date();
  const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);

  const workspace = await Workspace.findById(workspaceId).lean();

  const [
    vendorTierCounts,
    openRiskSeverityCounts,
    openRisksForAging,
    residualTrendRaw,
    engagementsForReduction,
    sensitiveExposureVendorIds,
    singleSourceTier1Count,
    overdueCapRisks,
    reassessmentDueVendors,
    stalledAssessments,
    offboardingDocs,
    evidenceGapCounts,
    cycleTimeAssessments,
    dueDateAssessments,
    capsForMttr,
    riskClosureTrendRaw,
    assessmentThroughputRaw,
    tier1VendorCount,
    assessedVendorIds,
  ] = await Promise.all([
    Vendor.aggregate([
      { $match: { workspace_id: workspaceId } },
      { $group: { _id: "$inherent_risk_tier", count: { $sum: 1 } } },
    ]),
    Risk.aggregate([
      { $match: { workspace_id: workspaceId, status: { $ne: "closed" } } },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]),
    Risk.find({ workspace_id: workspaceId, status: { $ne: "closed" } })
      .select("severity created_at")
      .lean(),
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
          total_residual: { $sum: "$residual_score" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Engagement.find({
      workspace_id: workspaceId,
      "inherent_score.total": { $ne: null },
    })
      .select("_id inherent_score.total")
      .lean(),
    Risk.distinct("vendor_id", {
      workspace_id: workspaceId,
      status: { $in: ["open", "mitigating"] },
      severity: { $in: ["critical", "high"] },
    }),
    Engagement.countDocuments({
      workspace_id: workspaceId,
      inherent_risk_tier: 1,
      "inherent_score.weights_snapshot.business_redundancy": "single_source",
    }),
    Risk.find({ workspace_id: workspaceId, "cap_tasks.status": "overdue" })
      .select("cap_tasks")
      .lean(),
    Assessment.find({
      workspace_id: workspaceId,
      status: "completed",
      next_review_due: { $ne: null, $lt: now },
    })
      .select("vendor_id next_review_due")
      .sort({ next_review_due: 1 })
      .lean(),
    Assessment.find({
      workspace_id: workspaceId,
      status: { $in: ["sent", "in_progress"] },
    })
      .select("vendor_id assigned_at due_date")
      .lean(),
    Offboarding.find({ workspace_id: workspaceId }).lean(),
    Response.aggregate([
      { $match: { workspace_id: workspaceId, response_value: { $ne: null } } },
      {
        $group: {
          _id: null,
          answered: { $sum: 1 },
          answered_no_evidence: {
            $sum: { $cond: [{ $eq: [{ $size: "$evidence" }, 0] }, 1, 0] },
          },
        },
      },
    ]),
    Assessment.find({
      workspace_id: workspaceId,
      assigned_at: { $ne: null },
    })
      .select("assigned_at submitted_at reviewed_at")
      .lean(),
    Assessment.find({
      workspace_id: workspaceId,
      due_date: { $ne: null },
      submitted_at: { $ne: null },
    })
      .select("due_date submitted_at")
      .lean(),
    Risk.aggregate([
      { $match: { workspace_id: workspaceId } },
      { $unwind: "$cap_tasks" },
      {
        $match: {
          "cap_tasks.status": "closed",
          "cap_tasks.closed_at": { $ne: null },
        },
      },
      {
        $project: {
          severity: 1,
          // cap_tasks subdocuments have no `created_at` (capTaskSchema isn't timestamped —
          // lib/db/models/risk.ts). task_id is an auto-generated ObjectId, and every
          // ObjectId embeds its creation time in its first 4 bytes — $toDate on an
          // ObjectId decodes exactly that, with no schema change needed.
          mttr_days: {
            $divide: [
              {
                $subtract: [
                  "$cap_tasks.closed_at",
                  { $toDate: "$cap_tasks.task_id" },
                ],
              },
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
    ]),
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
          closed: {
            $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Assessment.aggregate([
      {
        $match: {
          workspace_id: workspaceId,
          submitted_at: { $gte: twelveWeeksAgo, $ne: null },
        },
      },
      {
        $group: {
          _id: { $dateTrunc: { date: "$submitted_at", unit: "week" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Vendor.countDocuments({ workspace_id: workspaceId, inherent_risk_tier: 1 }),
    Assessment.distinct("vendor_id", {
      workspace_id: workspaceId,
      status: { $in: ["submitted", "under_review", "completed"] },
    }),
  ]);

  // --- Tier concentration ---
  let tier1 = 0;
  let unscored = 0;
  let totalVendors = 0;
  for (const row of vendorTierCounts as {
    _id: number | null;
    count: number;
  }[]) {
    totalVendors += row.count;
    if (row._id === 1) tier1 = row.count;
    else if (row._id === null) unscored += row.count;
  }

  // --- Open risk by severity ---
  const openRiskBySeverity: Record<RiskSeverityKey, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const row of openRiskSeverityCounts as {
    _id: string;
    count: number;
  }[]) {
    if (row._id in openRiskBySeverity) {
      openRiskBySeverity[row._id as RiskSeverityKey] = row.count;
    }
  }

  // --- Risk aging buckets ---
  const buckets: Record<RiskAgingBucket["bucket"], RiskAgingBucket> = {
    "0-30": { bucket: "0-30", critical: 0, high: 0, medium: 0, low: 0 },
    "31-60": { bucket: "31-60", critical: 0, high: 0, medium: 0, low: 0 },
    "61-90": { bucket: "61-90", critical: 0, high: 0, medium: 0, low: 0 },
    "90+": { bucket: "90+", critical: 0, high: 0, medium: 0, low: 0 },
  };
  for (const risk of openRisksForAging as {
    severity: string;
    created_at: Date;
  }[]) {
    const ageDays = daysBetween(now, risk.created_at);
    const key: RiskAgingBucket["bucket"] =
      ageDays <= 30
        ? "0-30"
        : ageDays <= 60
          ? "31-60"
          : ageDays <= 90
            ? "61-90"
            : "90+";
    if (risk.severity in buckets[key]) {
      (buckets[key] as unknown as Record<string, number>)[risk.severity] += 1;
    }
  }

  // --- Residual exposure trend ---
  const residualExposureTrend = (
    residualTrendRaw as Array<{ _id: Date; total_residual: number }>
  ).map((row) => ({
    week: row._id.toISOString().slice(0, 10),
    total_residual: row.total_residual,
  }));

  // --- Risk reduction effectiveness (inherent vs residual, per engagement's risks) ---
  const engagementIds = (
    engagementsForReduction as { _id: Types.ObjectId }[]
  ).map((e) => e._id);
  const inherentByEngagement = new Map(
    (
      engagementsForReduction as {
        _id: Types.ObjectId;
        inherent_score: { total: number | null };
      }[]
    ).map((e) => [e._id.toString(), e.inherent_score.total]),
  );
  const risksForReduction =
    engagementIds.length > 0
      ? await Risk.find({
          workspace_id: workspaceId,
          engagement_id: { $in: engagementIds },
        })
          .select("engagement_id residual_score")
          .lean()
      : [];
  const reductionPairs = risksForReduction
    .map((r) => {
      const inherent = inherentByEngagement.get(r.engagement_id.toString());
      return inherent != null ? { inherent, residual: r.residual_score } : null;
    })
    .filter((p): p is { inherent: number; residual: number } => p !== null);
  const avgInherent = average(reductionPairs.map((p) => p.inherent));
  const avgResidual = average(reductionPairs.map((p) => p.residual));
  const avgReductionPercent =
    avgInherent != null && avgInherent > 0 && avgResidual != null
      ? ((avgInherent - avgResidual) / avgInherent) * 100
      : null;

  // --- Overdue CAP age ---
  let overdueCapCount = 0;
  let maxOverdueCapDays: number | null = null;
  for (const risk of overdueCapRisks as {
    cap_tasks: { status: string; due_date: Date }[];
  }[]) {
    for (const task of risk.cap_tasks) {
      if (task.status === "overdue") {
        overdueCapCount += 1;
        const overdueDays = daysBetween(now, task.due_date);
        if (maxOverdueCapDays === null || overdueDays > maxOverdueCapDays) {
          maxOverdueCapDays = overdueDays;
        }
      }
    }
  }

  // --- Reassessment overdue ---
  const reassessmentVendorIds = (
    reassessmentDueVendors as { vendor_id: Types.ObjectId }[]
  ).map((a) => a.vendor_id);
  const stallVendorIds = (
    stalledAssessments as { vendor_id: Types.ObjectId }[]
  ).map((a) => a.vendor_id);
  const vendorNames = await Vendor.find({
    _id: { $in: [...reassessmentVendorIds, ...stallVendorIds] },
  })
    .select("legal_name")
    .lean();
  const vendorNameById = new Map(
    vendorNames.map((v) => [v._id.toString(), v.legal_name]),
  );

  const reassessmentOverdue = (
    reassessmentDueVendors as {
      _id: Types.ObjectId;
      vendor_id: Types.ObjectId;
      next_review_due: Date;
    }[]
  ).map((a) => ({
    vendor_id: a.vendor_id.toString(),
    vendor_name: vendorNameById.get(a.vendor_id.toString()) ?? "Unknown vendor",
    next_review_due: a.next_review_due.toISOString(),
    days_overdue: daysBetween(now, a.next_review_due),
  }));

  // --- Portal stall (sent/in_progress, either past due_date or open >14d) ---
  const portalStall = (
    stalledAssessments as {
      _id: Types.ObjectId;
      vendor_id: Types.ObjectId;
      assigned_at: Date | null;
      due_date: Date | null;
    }[]
  )
    .filter((a) => {
      if (!a.assigned_at) return false;
      const daysOpen = daysBetween(now, a.assigned_at);
      const pastDue = a.due_date != null && a.due_date < now;
      return pastDue || daysOpen > 14;
    })
    .map((a) => ({
      assessment_id: a._id.toString(),
      vendor_id: a.vendor_id.toString(),
      vendor_name:
        vendorNameById.get(a.vendor_id.toString()) ?? "Unknown vendor",
      days_open: a.assigned_at ? daysBetween(now, a.assigned_at) : 0,
      past_due: a.due_date != null && a.due_date < now,
    }));

  // --- Offboarding hygiene gaps: archived without both certs verified ---
  const offboardingHygieneGapCount = (
    offboardingDocs as {
      status: string;
      destruction_certificate: { verified_at: Date | null } | null;
      asset_return_attestation: { verified_at: Date | null } | null;
    }[]
  ).filter(
    (o) =>
      o.status === "archived" &&
      (!o.destruction_certificate?.verified_at ||
        !o.asset_return_attestation?.verified_at),
  ).length;

  // --- Evidence gap rate (approximation, see module comment) ---
  const evidenceGapRow = (
    evidenceGapCounts as { answered: number; answered_no_evidence: number }[]
  )[0];
  const evidenceGapRateApprox = evidenceGapRow
    ? (evidenceGapRow.answered_no_evidence / evidenceGapRow.answered) * 100
    : null;

  // --- Cycle time ---
  const assignToSubmit: number[] = [];
  const submitToReview: number[] = [];
  const endToEnd: number[] = [];
  for (const a of cycleTimeAssessments as {
    assigned_at: Date | null;
    submitted_at: Date | null;
    reviewed_at: Date | null;
  }[]) {
    if (a.assigned_at && a.submitted_at) {
      assignToSubmit.push(daysBetween(a.submitted_at, a.assigned_at));
    }
    if (a.submitted_at && a.reviewed_at) {
      submitToReview.push(daysBetween(a.reviewed_at, a.submitted_at));
    }
    if (a.assigned_at && a.reviewed_at) {
      endToEnd.push(daysBetween(a.reviewed_at, a.assigned_at));
    }
  }

  // --- On-time completion rate ---
  const dueDateSample = dueDateAssessments as {
    due_date: Date;
    submitted_at: Date;
  }[];
  const onTimeCount = dueDateSample.filter(
    (a) => a.submitted_at <= a.due_date,
  ).length;
  const onTimeCompletionRate =
    dueDateSample.length > 0
      ? (onTimeCount / dueDateSample.length) * 100
      : null;

  // --- MTTR by severity ---
  const mttrBySeverity: Record<RiskSeverityKey, number | null> = {
    critical: null,
    high: null,
    medium: null,
    low: null,
  };
  const mttrGroups: Record<RiskSeverityKey, number[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const row of capsForMttr as { severity: string; mttr_days: number }[]) {
    if (row.severity in mttrGroups) {
      mttrGroups[row.severity as RiskSeverityKey].push(row.mttr_days);
    }
  }
  for (const sev of RISK_SEVERITIES) {
    mttrBySeverity[sev] = average(mttrGroups[sev]);
  }

  // --- CAP closure rate (closed / (closed + open+in_progress+overdue), all-time) ---
  const [capStatusCounts] = await Promise.all([
    Risk.aggregate([
      { $match: { workspace_id: workspaceId } },
      { $unwind: "$cap_tasks" },
      { $group: { _id: "$cap_tasks.status", count: { $sum: 1 } } },
    ]),
  ]);
  let capClosed = 0;
  let capTotal = 0;
  for (const row of capStatusCounts as { _id: string; count: number }[]) {
    capTotal += row.count;
    if (row._id === "closed") capClosed = row.count;
  }
  const capClosureRate = capTotal > 0 ? (capClosed / capTotal) * 100 : null;

  // --- Risk closure trend / assessment throughput ---
  const riskClosureTrend = (
    riskClosureTrendRaw as Array<{ _id: Date; opened: number; closed: number }>
  ).map((row) => ({
    week: row._id.toISOString().slice(0, 10),
    opened: row.opened,
    closed: row.closed,
  }));
  const assessmentThroughput = (
    assessmentThroughputRaw as Array<{ _id: Date; count: number }>
  ).map((row) => ({
    week: row._id.toISOString().slice(0, 10),
    count: row.count,
  }));

  // --- Review coverage: % of Tier-1 vendors ever assessed ---
  const assessedTier1Count = await Vendor.countDocuments({
    workspace_id: workspaceId,
    inherent_risk_tier: 1,
    _id: { $in: assessedVendorIds as Types.ObjectId[] },
  });
  const reviewCoveragePercent =
    tier1VendorCount > 0 ? (assessedTier1Count / tier1VendorCount) * 100 : null;

  void workspace; // reserved for a future per-workspace override (e.g. cadence display)

  return {
    kri: {
      tier1_concentration: {
        count: tier1,
        percent: totalVendors > 0 ? (tier1 / totalVendors) * 100 : null,
      },
      unscored_vendor_count: unscored,
      open_risk_by_severity: openRiskBySeverity,
      risk_aging: Object.values(buckets),
      residual_exposure_trend: residualExposureTrend,
      risk_reduction_effectiveness: {
        avg_inherent: avgInherent,
        avg_residual: avgResidual,
        avg_reduction_percent: avgReductionPercent,
        sample_size: reductionPairs.length,
      },
      sensitive_data_exposure_count: (
        sensitiveExposureVendorIds as Types.ObjectId[]
      ).length,
      single_source_tier1_count: singleSourceTier1Count,
      overdue_cap_count: overdueCapCount,
      max_overdue_cap_days: maxOverdueCapDays,
      reassessment_overdue: reassessmentOverdue,
      portal_stall: portalStall,
      offboarding_hygiene_gap_count: offboardingHygieneGapCount,
      evidence_gap_rate_approx: evidenceGapRateApprox,
    },
    kpi: {
      cycle_time_days: {
        assign_to_submit_avg: average(assignToSubmit),
        submit_to_review_avg: average(submitToReview),
        end_to_end_avg: average(endToEnd),
        sample_size: endToEnd.length,
      },
      on_time_completion_rate: onTimeCompletionRate,
      mttr_days_by_severity: mttrBySeverity,
      cap_closure_rate: capClosureRate,
      risk_closure_trend: riskClosureTrend,
      assessment_throughput: assessmentThroughput,
      review_coverage_percent: reviewCoveragePercent,
    },
  };
}

export interface WorkspaceKriSummary {
  workspace_id: string;
  workspace_name: string;
  role: Role;
  tier1_count: number;
  open_critical_high_count: number;
  overdue_cap_count: number;
  reassessment_overdue_count: number;
}

export interface RollupAnalyticsResult {
  workspaces: WorkspaceKriSummary[];
}

/**
 * Cross-workspace summary for the Phase D executive-rollup charts (grouped-bar tier
 * comparison, CAP age buckets). Reuses `getExecutiveRollup()`'s per-membership
 * authorization loop (`lib/services/executive-rollup.ts`, `DECISIONS.md` 024) rather than
 * a single top-level check — a viewer-in-A/admin-in-B user must see exactly the workspaces
 * their per-workspace role actually grants `rollup.view` for, same as the existing rollup.
 */
export async function getRollupAnalyticsSummary(
  userId: string,
): Promise<RollupAnalyticsResult> {
  await dbConnect();

  const user = await User.findOne({ _id: userId, status: "active" }).lean();
  if (!user) return { workspaces: [] };

  const authorizedMemberships = user.memberships.filter((m) =>
    roleHasCapability(m.role as Role, "rollup.view"),
  );

  const workspaceDocs = await Workspace.find({
    _id: { $in: authorizedMemberships.map((m) => m.workspace_id) },
  }).lean();
  const nameById = new Map(
    workspaceDocs.map((w) => [w._id.toString(), w.entity_name]),
  );

  const now = new Date();
  const workspaces: WorkspaceKriSummary[] = [];
  for (const membership of authorizedMemberships) {
    const workspaceId = membership.workspace_id;

    const [
      tier1Count,
      openCriticalHighCount,
      overdueCapCount,
      reassessmentOverdueCount,
    ] = await Promise.all([
      Vendor.countDocuments({
        workspace_id: workspaceId,
        inherent_risk_tier: 1,
      }),
      Risk.countDocuments({
        workspace_id: workspaceId,
        status: { $in: ["open", "mitigating"] },
        severity: { $in: ["critical", "high"] },
      }),
      Risk.countDocuments({
        workspace_id: workspaceId,
        "cap_tasks.status": "overdue",
      }),
      Assessment.countDocuments({
        workspace_id: workspaceId,
        status: "completed",
        next_review_due: { $ne: null, $lt: now },
      }),
    ]);

    workspaces.push({
      workspace_id: workspaceId.toString(),
      workspace_name:
        nameById.get(workspaceId.toString()) ?? "Unknown workspace",
      role: membership.role as Role,
      tier1_count: tier1Count,
      open_critical_high_count: openCriticalHighCount,
      overdue_cap_count: overdueCapCount,
      reassessment_overdue_count: reassessmentOverdueCount,
    });
  }

  return { workspaces };
}
