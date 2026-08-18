// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import { Vendor } from "@/lib/db/models/vendor";
import { Engagement } from "@/lib/db/models/engagement";
import { Assessment } from "@/lib/db/models/assessment";
import { Risk } from "@/lib/db/models/risk";
import { Response } from "@/lib/db/models/response";
import {
  getWorkspaceAnalytics,
  getRollupAnalyticsSummary,
  getVendorScorecard,
} from "@/lib/services/analytics";

/**
 * UI Revamp Round 2 (DECISIONS.md 028/029) — closes lib/services/dashboard.ts-adjacent
 * test debt by covering the new analytics module directly against a real MongoDB, the
 * same discipline every other service in this codebase uses (TEST-CHECKLIST.md Gate 2).
 * Also verifies the null-exclusion rule: a record missing a Round-2 timestamp must be
 * excluded from the relevant average, never defaulted to another date.
 */
describe("analytics service (integration)", () => {
  const workspaceId = new Types.ObjectId();
  const vendorTier1 = new Types.ObjectId();
  const vendorUnscored = new Types.ObjectId();
  const engagementId = new Types.ObjectId();
  const businessOwnerId = new Types.ObjectId();

  const now = Date.now();
  const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);
  const futureDays = (n: number) => new Date(now + n * 24 * 60 * 60 * 1000);

  beforeAll(async () => {
    await dbConnect();

    await Workspace.create({
      _id: workspaceId,
      entity_name: "Analytics Test Workspace",
      slug: `analytics-test-${workspaceId.toString()}`,
      settings: {
        weights_version: 1,
        tier_thresholds: { tier1_min: 70, tier2_min: 40 },
        enterprise_risk_categories: [],
      },
      status: "active",
    });

    await Vendor.create([
      {
        _id: vendorTier1,
        workspace_id: workspaceId,
        legal_name: "Tier 1 Vendor",
        domain: `analytics-tier1-${workspaceId.toString()}.example`,
        spoc: {
          spoc_name: "S",
          spoc_email: "s@analytics.example",
          spoc_phone: "+1",
        },
        inherent_risk_tier: 1,
      },
      {
        _id: vendorUnscored,
        workspace_id: workspaceId,
        legal_name: "Unscored Vendor",
        domain: `analytics-unscored-${workspaceId.toString()}.example`,
        spoc: {
          spoc_name: "S",
          spoc_email: "s2@analytics.example",
          spoc_phone: "+1",
        },
        inherent_risk_tier: null,
      },
    ]);

    await Engagement.create({
      _id: engagementId,
      workspace_id: workspaceId,
      vendor_id: vendorTier1,
      business_owner_id: businessOwnerId,
      business_unit: "Engineering",
      functional_scope: "Payments",
      expected_procurement_date: new Date("2026-09-01"),
      inherent_score: { total: 60, breakdown: {}, weights_version: 1 },
      inherent_risk_tier: 1,
      status: "in_assessment",
    });

    // Reassessment overdue: completed, next_review_due in the past.
    await Assessment.create({
      workspace_id: workspaceId,
      engagement_id: engagementId,
      vendor_id: vendorTier1,
      template_id: new Types.ObjectId(),
      template_version: 1,
      template_snapshot: { schema_format_version: 1, sections: [] },
      status: "completed",
      reviewed_at: days(400),
      next_review_due: days(30),
    });

    // On-time, cycle-time sample: assigned -> submitted -> reviewed, all timestamps present.
    await Assessment.create({
      workspace_id: workspaceId,
      engagement_id: engagementId,
      vendor_id: vendorTier1,
      template_id: new Types.ObjectId(),
      template_version: 1,
      template_snapshot: { schema_format_version: 1, sections: [] },
      status: "completed",
      assigned_at: days(20),
      due_date: days(5),
      submitted_at: days(10), // submitted before due_date -> on time
      reviewed_at: days(2),
    });

    // Late completion: submitted after due_date.
    await Assessment.create({
      workspace_id: workspaceId,
      engagement_id: engagementId,
      vendor_id: vendorTier1,
      template_id: new Types.ObjectId(),
      template_version: 1,
      template_snapshot: { schema_format_version: 1, sections: [] },
      status: "completed",
      assigned_at: days(40),
      due_date: days(25),
      submitted_at: days(20), // after due_date -> late
    });

    // Portal stall: still sent, assigned 20 days ago, due_date already past.
    await Assessment.create({
      workspace_id: workspaceId,
      engagement_id: engagementId,
      vendor_id: vendorTier1,
      template_id: new Types.ObjectId(),
      template_version: 1,
      template_snapshot: { schema_format_version: 1, sections: [] },
      status: "sent",
      assigned_at: days(20),
      due_date: days(5),
    });

    // Pre-Round-2 assessment: no due_date/next_review_due at all — must be excluded, not
    // treated as zero or defaulted.
    await Assessment.create({
      workspace_id: workspaceId,
      engagement_id: engagementId,
      vendor_id: vendorTier1,
      template_id: new Types.ObjectId(),
      template_version: 1,
      template_snapshot: { schema_format_version: 1, sections: [] },
      status: "completed",
      assigned_at: days(100),
      submitted_at: days(90),
      reviewed_at: days(85),
    });

    // Open risks at different ages, for the aging buckets + severity counts.
    await Risk.create([
      {
        workspace_id: workspaceId,
        assessment_id: new Types.ObjectId(),
        engagement_id: engagementId,
        vendor_id: vendorTier1,
        control_id: "AGE-01",
        title: "Fresh critical risk",
        severity: "critical",
        enterprise_risk_category: "Information Security",
        impact_level: "high",
        residual_score: 80,
        status: "open",
        created_at: days(5),
      },
      {
        workspace_id: workspaceId,
        assessment_id: new Types.ObjectId(),
        engagement_id: engagementId,
        vendor_id: vendorTier1,
        control_id: "AGE-02",
        title: "Aging high risk",
        severity: "high",
        enterprise_risk_category: "Information Security",
        impact_level: "high",
        residual_score: 60,
        status: "mitigating",
        created_at: days(95),
      },
    ]);

    // CAP tasks: one overdue, one closed (for MTTR + closure rate).
    await Risk.create({
      workspace_id: workspaceId,
      assessment_id: new Types.ObjectId(),
      engagement_id: engagementId,
      vendor_id: vendorTier1,
      control_id: "CAP-01",
      title: "Risk with CAP tasks",
      severity: "medium",
      enterprise_risk_category: "Information Security",
      impact_level: "medium",
      residual_score: 30,
      status: "mitigating",
      cap_tasks: [
        {
          description: "Overdue task",
          owner_type: "internal",
          owner_ref: businessOwnerId,
          due_date: days(10),
          status: "overdue",
        },
        {
          description: "Closed task",
          owner_type: "internal",
          owner_ref: businessOwnerId,
          due_date: futureDays(30),
          status: "closed",
          closed_at: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    await Promise.all([
      Workspace.deleteOne({ _id: workspaceId }),
      Vendor.deleteMany({ workspace_id: workspaceId }),
      Engagement.deleteMany({ workspace_id: workspaceId }),
      Assessment.deleteMany({ workspace_id: workspaceId }),
      Risk.deleteMany({ workspace_id: workspaceId }),
    ]);
  });

  it("computes tier concentration, unscored count, and open risk by severity", async () => {
    const result = await getWorkspaceAnalytics({ workspaceId });

    expect(result.kri.tier1_concentration.count).toBe(1);
    expect(result.kri.tier1_concentration.percent).toBe(50);
    expect(result.kri.unscored_vendor_count).toBe(1);
    expect(result.kri.open_risk_by_severity.critical).toBe(1);
    expect(result.kri.open_risk_by_severity.high).toBe(1);
  });

  it("buckets open risks by age, excluding closed risks", async () => {
    const result = await getWorkspaceAnalytics({ workspaceId });
    const fresh = result.kri.risk_aging.find((b) => b.bucket === "0-30")!;
    const old = result.kri.risk_aging.find((b) => b.bucket === "90+")!;
    expect(fresh.critical).toBe(1);
    expect(old.high).toBe(1);
  });

  it("reports overdue CAP count and max overdue age, and a non-null CAP closure rate", async () => {
    const result = await getWorkspaceAnalytics({ workspaceId });
    expect(result.kri.overdue_cap_count).toBe(1);
    expect(result.kri.max_overdue_cap_days).toBeGreaterThanOrEqual(10);
    // 1 closed / 2 total cap_tasks
    expect(result.kpi.cap_closure_rate).toBe(50);
  });

  it("flags the vendor with a past next_review_due as reassessment-overdue", async () => {
    const result = await getWorkspaceAnalytics({ workspaceId });
    expect(result.kri.reassessment_overdue).toHaveLength(1);
    expect(result.kri.reassessment_overdue[0]!.vendor_id).toBe(
      vendorTier1.toString(),
    );
    expect(
      result.kri.reassessment_overdue[0]!.days_overdue,
    ).toBeGreaterThanOrEqual(30);
  });

  it("flags a sent-but-unsubmitted assessment past its due_date as a portal stall", async () => {
    const result = await getWorkspaceAnalytics({ workspaceId });
    const stalled = result.kri.portal_stall.find(
      (s) => s.vendor_id === vendorTier1.toString(),
    );
    expect(stalled).toBeDefined();
    expect(stalled?.past_due).toBe(true);
  });

  it("computes on-time completion rate only from assessments with both due_date and submitted_at", async () => {
    const result = await getWorkspaceAnalytics({ workspaceId });
    // 1 on-time (submitted before due_date) out of 2 assessments that have both fields —
    // the pre-Round-2 assessment (no due_date at all) must NOT dilute the denominator.
    expect(result.kpi.on_time_completion_rate).toBe(50);
  });

  it("computes cycle time only from assessments carrying the relevant timestamp pair", async () => {
    const result = await getWorkspaceAnalytics({ workspaceId });
    expect(result.kpi.cycle_time_days.assign_to_submit_avg).not.toBeNull();
    expect(result.kpi.cycle_time_days.end_to_end_avg).not.toBeNull();
  });

  it("computes review coverage as the percent of Tier-1 vendors ever assessed", async () => {
    const result = await getWorkspaceAnalytics({ workspaceId });
    // Only vendorTier1 is Tier 1, and it has assessments in submitted/under_review/completed
    // status — 1/1 = 100%.
    expect(result.kpi.review_coverage_percent).toBe(100);
  });
});

describe("getRollupAnalyticsSummary (integration)", () => {
  const workspaceAdmin = new Types.ObjectId();
  const workspaceViewerOnly = new Types.ObjectId();
  const userId = new Types.ObjectId();

  beforeAll(async () => {
    await dbConnect();
    await Workspace.create([
      {
        _id: workspaceAdmin,
        entity_name: "Rollup Analytics Admin Workspace",
        slug: `rollup-analytics-admin-${workspaceAdmin.toString()}`,
        settings: {
          weights_version: 1,
          tier_thresholds: { tier1_min: 70, tier2_min: 40 },
          enterprise_risk_categories: [],
        },
        status: "active",
      },
      {
        _id: workspaceViewerOnly,
        entity_name: "Rollup Analytics Viewer-Only Workspace",
        slug: `rollup-analytics-viewer-${workspaceViewerOnly.toString()}`,
        settings: {
          weights_version: 1,
          tier_thresholds: { tier1_min: 70, tier2_min: 40 },
          enterprise_risk_categories: [],
        },
        status: "active",
      },
    ]);

    await User.create({
      _id: userId,
      email: "rollup-analytics@rollup-test.example",
      name: "Rollup Analytics User",
      password_hash: "not-a-real-hash",
      memberships: [
        { workspace_id: workspaceAdmin, role: "admin" },
        { workspace_id: workspaceViewerOnly, role: "viewer" },
      ],
      status: "active",
    });

    const tier1Vendor = await Vendor.create({
      workspace_id: workspaceAdmin,
      legal_name: "Rollup Tier 1 Vendor",
      domain: `rollup-analytics-tier1-${workspaceAdmin.toString()}.example`,
      spoc: {
        spoc_name: "S",
        spoc_email: "s@rollup-analytics.example",
        spoc_phone: "+1",
      },
      inherent_risk_tier: 1,
    });
    await Vendor.create({
      workspace_id: workspaceAdmin,
      legal_name: "Rollup Tier 2 Vendor",
      domain: `rollup-analytics-tier2-${workspaceAdmin.toString()}.example`,
      spoc: {
        spoc_name: "S",
        spoc_email: "s2@rollup-analytics.example",
        spoc_phone: "+1",
      },
      inherent_risk_tier: 2,
    });

    const engagement = await Engagement.create({
      workspace_id: workspaceAdmin,
      vendor_id: tier1Vendor._id,
      business_owner_id: new Types.ObjectId(),
      business_unit: "Engineering",
      functional_scope: "Rollup fixture",
      expected_procurement_date: new Date("2026-09-01"),
      inherent_risk_tier: 1,
      status: "in_assessment",
    });

    // An overdue CAP task 45 days past due -> falls in the "31-60 day" bucket.
    await Risk.create({
      workspace_id: workspaceAdmin,
      assessment_id: new Types.ObjectId(),
      engagement_id: engagement._id,
      vendor_id: tier1Vendor._id,
      control_id: "ROLLUP-CAP-01",
      title: "Rollup fixture risk",
      severity: "high",
      enterprise_risk_category: "Information Security",
      impact_level: "high",
      residual_score: 50,
      status: "mitigating",
      cap_tasks: [
        {
          description: "Overdue remediation",
          owner_type: "internal",
          owner_ref: new Types.ObjectId(),
          due_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          status: "overdue",
        },
      ],
    });
  });

  afterAll(async () => {
    await User.deleteOne({ _id: userId });
    await Vendor.deleteMany({
      workspace_id: { $in: [workspaceAdmin, workspaceViewerOnly] },
    });
    await Engagement.deleteMany({
      workspace_id: { $in: [workspaceAdmin, workspaceViewerOnly] },
    });
    await Risk.deleteMany({
      workspace_id: { $in: [workspaceAdmin, workspaceViewerOnly] },
    });
    await Workspace.deleteMany({
      _id: { $in: [workspaceAdmin, workspaceViewerOnly] },
    });
  });

  it("includes only the workspace where the membership role grants rollup.view", async () => {
    const result = await getRollupAnalyticsSummary(userId.toString());

    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0]!.workspace_id).toBe(workspaceAdmin.toString());
    expect(result.workspaces[0]!.tier1_count).toBe(1);
    expect(
      result.workspaces.some(
        (w) => w.workspace_id === workspaceViewerOnly.toString(),
      ),
    ).toBe(false);
  });

  it("computes the full tier breakdown and CAP age buckets for Phase D's comparison charts", async () => {
    const result = await getRollupAnalyticsSummary(userId.toString());
    const ws = result.workspaces[0]!;

    expect(ws.vendors_by_tier).toEqual({
      tier1: 1,
      tier2: 1,
      tier3: 0,
      unscored: 0,
    });
    expect(ws.cap_age_buckets.d31to60).toBe(1);
    expect(
      ws.cap_age_buckets.d0to30 +
        ws.cap_age_buckets.d61to90 +
        ws.cap_age_buckets.d90plus,
    ).toBe(0);
  });
});

describe("getVendorScorecard (integration)", () => {
  const workspaceId = new Types.ObjectId();
  const vendorId = new Types.ObjectId();
  const otherVendorId = new Types.ObjectId();
  const engagementId = new Types.ObjectId();
  const assessmentId = new Types.ObjectId();
  const businessOwnerId = new Types.ObjectId();

  beforeAll(async () => {
    await dbConnect();

    await Workspace.create({
      _id: workspaceId,
      entity_name: "Scorecard Test Workspace",
      slug: `scorecard-test-${workspaceId.toString()}`,
      settings: {
        weights_version: 1,
        tier_thresholds: { tier1_min: 70, tier2_min: 40 },
        enterprise_risk_categories: [],
      },
      status: "active",
    });

    await Vendor.create([
      {
        _id: vendorId,
        workspace_id: workspaceId,
        legal_name: "Scorecard Vendor",
        domain: `scorecard-${workspaceId.toString()}.example`,
        spoc: {
          spoc_name: "S",
          spoc_email: "s@scorecard.example",
          spoc_phone: "+1",
        },
        inherent_risk_tier: 1,
      },
      {
        _id: otherVendorId,
        workspace_id: workspaceId,
        legal_name: "Other Vendor",
        domain: `scorecard-other-${workspaceId.toString()}.example`,
        spoc: {
          spoc_name: "S",
          spoc_email: "s2@scorecard.example",
          spoc_phone: "+1",
        },
        inherent_risk_tier: 1,
      },
    ]);

    await Engagement.create({
      _id: engagementId,
      workspace_id: workspaceId,
      vendor_id: vendorId,
      business_owner_id: businessOwnerId,
      business_unit: "Engineering",
      functional_scope: "Scorecard fixture",
      expected_procurement_date: new Date("2026-09-01"),
      inherent_score: { total: 80, breakdown: {}, weights_version: 1 },
      inherent_risk_tier: 1,
      status: "in_assessment",
    });

    await Assessment.create({
      _id: assessmentId,
      workspace_id: workspaceId,
      engagement_id: engagementId,
      vendor_id: vendorId,
      template_id: new Types.ObjectId(),
      template_version: 1,
      template_snapshot: { schema_format_version: 1, sections: [] },
      status: "completed",
      assigned_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      submitted_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      reviewed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      next_review_due: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // already overdue
    });

    // A second, different vendor's assessment/risk in the same workspace — must never
    // leak into the first vendor's scorecard.
    const otherEngagementId = new Types.ObjectId();
    await Engagement.create({
      workspace_id: workspaceId,
      vendor_id: otherVendorId,
      business_owner_id: businessOwnerId,
      business_unit: "Other",
      functional_scope: "Other fixture",
      expected_procurement_date: new Date("2026-09-01"),
      inherent_risk_tier: 1,
      status: "in_assessment",
    });
    await Risk.create({
      workspace_id: workspaceId,
      assessment_id: new Types.ObjectId(),
      engagement_id: otherEngagementId,
      vendor_id: otherVendorId,
      control_id: "OTHER-01",
      title: "Should never appear in vendor's scorecard",
      severity: "critical",
      enterprise_risk_category: "Information Security",
      impact_level: "critical",
      residual_score: 99,
      status: "open",
    });

    await Risk.create([
      {
        workspace_id: workspaceId,
        assessment_id: assessmentId,
        engagement_id: engagementId,
        vendor_id: vendorId,
        control_id: "SC-01",
        title: "Open high risk",
        severity: "high",
        enterprise_risk_category: "Information Security",
        impact_level: "high",
        residual_score: 40,
        status: "open",
        cap_tasks: [
          {
            description: "Overdue remediation",
            owner_type: "internal",
            owner_ref: businessOwnerId,
            due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            status: "overdue",
          },
        ],
      },
      {
        workspace_id: workspaceId,
        assessment_id: assessmentId,
        engagement_id: engagementId,
        vendor_id: vendorId,
        control_id: "SC-02",
        title: "Closed risk",
        severity: "medium",
        enterprise_risk_category: "Information Security",
        impact_level: "medium",
        residual_score: 20,
        status: "closed",
        closed_at: new Date(),
      },
    ]);

    await Response.create([
      {
        workspace_id: workspaceId,
        assessment_id: assessmentId,
        control_id: "SC-01",
        question_text: "Q1?",
        response_value: "yes",
        evidence: [
          {
            file_key: "demo/key",
            filename: "evidence.pdf",
            mime: "application/pdf",
            size: 100,
            uploaded_at: new Date(),
            uploaded_by: businessOwnerId,
          },
        ],
      },
      {
        workspace_id: workspaceId,
        assessment_id: assessmentId,
        control_id: "SC-02",
        question_text: "Q2?",
        response_value: "no",
        evidence: [],
      },
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      Workspace.deleteOne({ _id: workspaceId }),
      Vendor.deleteMany({ workspace_id: workspaceId }),
      Engagement.deleteMany({ workspace_id: workspaceId }),
      Assessment.deleteMany({ workspace_id: workspaceId }),
      Risk.deleteMany({ workspace_id: workspaceId }),
      Response.deleteMany({ workspace_id: workspaceId }),
    ]);
    await mongoose.disconnect();
  });

  it("computes inherent vs residual, open risk severity, and CAP status scoped to one vendor only", async () => {
    const result = await getVendorScorecard(
      { workspaceId },
      vendorId.toString(),
    );

    expect(result.inherent_score).toBe(80);
    expect(result.residual_total).toBe(40); // only the open risk; closed risk excluded
    expect(result.reduction_percent).toBe(50); // (80-40)/80
    expect(result.open_risk_by_severity.high).toBe(1);
    expect(result.open_risk_by_severity.critical).toBe(0); // other vendor's risk excluded
    expect(result.cap_tasks.overdue).toBe(1);
  });

  it("computes evidence coverage and flags the already-overdue next_review_due", async () => {
    const result = await getVendorScorecard(
      { workspaceId },
      vendorId.toString(),
    );

    expect(result.evidence_coverage_percent).toBe(50); // 1 of 2 answered responses
    expect(result.next_review_due).not.toBeNull();
    expect(result.reassessment_overdue).toBe(true);
    expect(result.assessment_history).toHaveLength(1);
    expect(result.assessment_history[0]!.status).toBe("completed");
  });
});
