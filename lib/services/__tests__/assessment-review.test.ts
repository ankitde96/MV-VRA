// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { Vendor } from "@/lib/db/models/vendor";
import { Engagement } from "@/lib/db/models/engagement";
import { Assessment } from "@/lib/db/models/assessment";
import { Risk } from "@/lib/db/models/risk";
import { User } from "@/lib/db/models/user";
import { AuditEvent } from "@/lib/db/models/audit-event";
import { Response } from "@/lib/db/models/response";
import { AssessmentReviewService } from "@/lib/services/assessment-review";
import { getMailer } from "@/lib/mail";

/**
 * TEST-CHECKLIST.md Gate 2: closes the gap flagged in HANDOVER.md — Phase 8 shipped
 * AssessmentReviewService/RiskRepository with no automated test, verified only by a
 * hand-checked real HTTP request. Requires a real MongoDB replica set (DECISIONS.md 014)
 * since raiseRisk()/updateRisk() write risks + the assessment's derived overall_score.
 */
describe("AssessmentReviewService (integration)", () => {
  const workspaceId = new Types.ObjectId();
  const otherWorkspaceId = new Types.ObjectId();
  const vendorId = new Types.ObjectId();
  const engagementId = new Types.ObjectId();
  const businessOwnerId = new Types.ObjectId();

  async function seedFixtures(inherentScoreTotal: number | null = 60) {
    await Workspace.create({
      _id: workspaceId,
      entity_name: "Review Test Workspace",
      slug: `review-test-${workspaceId.toString()}`,
      settings: {
        risk_weights: {},
        weights_version: 1,
        tier_thresholds: { tier1_min: 70, tier2_min: 40 },
        enterprise_risk_categories: [],
      },
      status: "active",
    });

    await Vendor.create({
      _id: vendorId,
      workspace_id: workspaceId,
      legal_name: "Review Test Vendor",
      domain: `review-test-${vendorId.toString()}.example`,
      spoc: {
        spoc_name: "S Poc",
        spoc_email: "spoc@review-test.example",
        spoc_phone: "+1",
      },
      // ASSESSMENT-WORKFLOW-PLAN.md Stage 2 — the vendor-owned CAP escalation email now
      // reads the primary spocs[] entry, not the legacy `spoc` object above.
      spocs: [
        {
          name: "S Poc",
          email: "spoc@review-test.example",
          phone: "+1",
          is_primary: true,
          status: "active",
        },
      ],
      inherent_risk_tier: 2,
      lifecycle_status: "active",
    });

    await Engagement.create({
      _id: engagementId,
      workspace_id: workspaceId,
      vendor_id: vendorId,
      business_owner_id: businessOwnerId,
      business_unit: "Engineering",
      functional_scope: "Payments",
      expected_procurement_date: new Date("2026-09-01"),
      data_classification: ["pii"],
      inherent_score: {
        total: inherentScoreTotal,
        breakdown: {},
        weights_version: 1,
      },
      inherent_risk_tier: 2,
      status: "in_assessment",
    });

    const assessment = await Assessment.create({
      workspace_id: workspaceId,
      engagement_id: engagementId,
      vendor_id: vendorId,
      template_id: new Types.ObjectId(),
      template_version: 1,
      template_snapshot: { schema_format_version: 1, sections: [] },
      status: "submitted",
      overall_score: null,
      submitted_at: new Date(),
    });

    return assessment;
  }

  afterEach(async () => {
    await Promise.all([
      Workspace.deleteMany({ _id: { $in: [workspaceId, otherWorkspaceId] } }),
      Vendor.deleteMany({
        workspace_id: { $in: [workspaceId, otherWorkspaceId] },
      }),
      Engagement.deleteMany({
        workspace_id: { $in: [workspaceId, otherWorkspaceId] },
      }),
      Assessment.deleteMany({
        workspace_id: { $in: [workspaceId, otherWorkspaceId] },
      }),
      Risk.deleteMany({
        workspace_id: { $in: [workspaceId, otherWorkspaceId] },
      }),
      AuditEvent.deleteMany({
        workspace_id: { $in: [workspaceId, otherWorkspaceId] },
      }),
      Response.deleteMany({
        workspace_id: { $in: [workspaceId, otherWorkspaceId] },
      }),
      User.deleteMany({
        "memberships.workspace_id": {
          $in: [workspaceId, otherWorkspaceId],
        },
      }),
    ]);
  });

  it("returns evidence timestamps and batched workspace-scoped uploader labels", async () => {
    await dbConnect();
    const assessment = await seedFixtures();
    await Assessment.updateOne(
      { _id: assessment._id },
      {
        $set: {
          template_snapshot: {
            schema_format_version: 1,
            sections: [
              {
                id: "evidence",
                title: "Evidence",
                questions: [
                  {
                    control_id: "EV-1",
                    text: "Provide evidence",
                    type: "text",
                    required: true,
                  },
                ],
              },
            ],
          },
        },
      },
    );
    const vendor = await Vendor.findById(vendorId).lean();
    const spocId = vendor?.spocs[0]?._id;
    if (!spocId) throw new Error("Expected seeded SPOC");
    const internalUploader = await User.create({
      email: `review-uploader-${workspaceId.toString()}@example.test`,
      name: "Internal Uploader",
      password_hash: "not-used",
      memberships: [{ workspace_id: workspaceId, role: "risk_analyst" }],
      status: "active",
    });
    const foreignUploader = await User.create({
      email: `foreign-uploader-${otherWorkspaceId.toString()}@example.test`,
      name: "Foreign Uploader",
      password_hash: "not-used",
      memberships: [{ workspace_id: otherWorkspaceId, role: "risk_analyst" }],
      status: "active",
    });
    const uploadedAt = new Date("2026-08-20T01:02:03.000Z");
    await Response.create({
      workspace_id: workspaceId,
      assessment_id: assessment._id,
      control_id: "EV-1",
      question_text: "Provide evidence",
      response_value: "Attached",
      evidence: [
        {
          file_key: "spoc.pdf",
          filename: "spoc.pdf",
          mime: "application/pdf",
          size: 1,
          uploaded_at: uploadedAt,
          uploaded_by: spocId,
        },
        {
          file_key: "internal.pdf",
          filename: "internal.pdf",
          mime: "application/pdf",
          size: 1,
          uploaded_at: uploadedAt,
          uploaded_by: internalUploader._id,
        },
        {
          file_key: "legacy.pdf",
          filename: "legacy.pdf",
          mime: "application/pdf",
          size: 1,
          uploaded_at: uploadedAt,
          uploaded_by: vendorId,
        },
        {
          file_key: "foreign.pdf",
          filename: "foreign.pdf",
          mime: "application/pdf",
          size: 1,
          uploaded_at: uploadedAt,
          uploaded_by: foreignUploader._id,
        },
      ],
    });

    const result = await new AssessmentReviewService({
      workspaceId,
    }).getAssessmentReviewData(assessment._id.toString());
    const evidence = result.questions[0]?.evidence;

    expect(evidence?.map((item) => item.uploaded_by_label)).toEqual([
      "S Poc",
      "Internal Uploader",
      "Review Test Vendor",
      "Unknown uploader",
    ]);
    expect(evidence?.[0]?.uploaded_at).toBe(uploadedAt.toISOString());
  });

  it("marks response verdicts and resends only when a non-compliant response exists", async () => {
    await dbConnect();
    const assessment = await seedFixtures();
    await Assessment.updateOne(
      { _id: assessment._id },
      {
        $set: {
          template_snapshot: {
            schema_format_version: 1,
            sections: [
              {
                id: "s",
                title: "S",
                questions: [
                  {
                    control_id: "Q1",
                    text: "Q1?",
                    type: "text",
                    required: true,
                  },
                ],
              },
            ],
          },
        },
      },
    );
    await Response.create({
      workspace_id: workspaceId,
      assessment_id: assessment._id,
      control_id: "Q1",
      question_text: "Q1?",
      response_value: "answer",
    });
    const actorId = new Types.ObjectId();
    const service = new AssessmentReviewService({ workspaceId });
    await service.markResponseReview(
      assessment._id.toString(),
      "Q1",
      { review_status: "non_compliant", reviewer_note: "Please revise" },
      actorId.toString(),
    );
    const result = await service.resendQuestionnaire(
      assessment._id.toString(),
      actorId.toString(),
    );
    expect(result.status).toBe("changes_requested");
    const stored = await Assessment.findById(assessment._id);
    expect(stored?.review_round).toBe(1);
    expect(stored?.resent_by?.toString()).toBe(actorId.toString());
    expect(
      (await Response.findOne({ assessment_id: assessment._id }))
        ?.review_status,
    ).toBe("non_compliant");
  });

  it("blocks completion for unmarked controls and non-compliant controls without a risk", async () => {
    await dbConnect();
    const assessment = await seedFixtures();
    await Assessment.updateOne(
      { _id: assessment._id },
      {
        $set: {
          template_snapshot: {
            schema_format_version: 1,
            sections: [
              {
                id: "s",
                title: "S",
                questions: [
                  {
                    control_id: "Q1",
                    text: "Q1?",
                    type: "text",
                    required: true,
                  },
                ],
              },
            ],
          },
        },
      },
    );
    await Response.create({
      workspace_id: workspaceId,
      assessment_id: assessment._id,
      control_id: "Q1",
      question_text: "Q1?",
      response_value: "answer",
    });
    const service = new AssessmentReviewService({ workspaceId });
    await expect(
      service.completeReview(assessment._id.toString()),
    ).rejects.toThrow(/unmarked: Q1/);
    await service.markResponseReview(
      assessment._id.toString(),
      "Q1",
      { review_status: "non_compliant" },
      new Types.ObjectId().toString(),
    );
    await expect(
      service.completeReview(assessment._id.toString()),
    ).rejects.toThrow(/non-compliant without risk: Q1/);

    await service.raiseRisk(assessment._id.toString(), {
      control_id: "Q1",
      title: "Question requires remediation",
      severity: "medium",
      enterprise_risk_category: "Information Security",
      impact_level: "medium",
    });
    await expect(
      service.completeReview(assessment._id.toString()),
    ).resolves.toMatchObject({ status: "completed" });
  });

  it("refuses to resend when no response is non-compliant", async () => {
    await dbConnect();
    const assessment = await seedFixtures();
    const service = new AssessmentReviewService({ workspaceId });

    await expect(
      service.resendQuestionnaire(
        assessment._id.toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(/at least one response non-compliant/i);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("raiseRisk() computes an authoritative residual_score and derives assessment.overall_score from it", async () => {
    await dbConnect();
    const assessment = await seedFixtures(60);
    const service = new AssessmentReviewService({ workspaceId });

    const result = await service.raiseRisk(assessment._id.toString(), {
      control_id: "HOST-02",
      title: "Missing encryption at rest",
      description: "No evidence of disk-level encryption.",
      severity: "high",
      enterprise_risk_category: "Information Security",
      impact_level: "high",
      compensating_controls: [],
    });

    // base(30) blended 70/30 with inherent_score(60) = 21 + 18 = 39
    expect(result.residual_score).toBe(39);
    expect(result.overall_score).toBe(39);

    const storedRisk = await Risk.findById(result.risk_id);
    expect(storedRisk?.residual_score).toBe(39);
    expect(storedRisk?.status).toBe("open");

    const storedAssessment = await Assessment.findById(assessment._id);
    expect(storedAssessment?.overall_score).toBe(39);
    // A submitted assessment moves to under_review the moment a risk is raised against it.
    expect(storedAssessment?.status).toBe("under_review");

    const auditEntry = await AuditEvent.findOne({ entity_id: storedRisk?._id });
    expect(auditEntry?.action).toBe("risk.created");
  });

  it("assessment.overall_score always equals the sum of its risks' residual_score across multiple raises", async () => {
    await dbConnect();
    const assessment = await seedFixtures(60);
    const service = new AssessmentReviewService({ workspaceId });

    const first = await service.raiseRisk(assessment._id.toString(), {
      control_id: "HOST-01",
      title: "Risk one",
      severity: "high",
      enterprise_risk_category: "Information Security",
      impact_level: "high",
    });
    const second = await service.raiseRisk(assessment._id.toString(), {
      control_id: "HOST-02",
      title: "Risk two",
      severity: "critical",
      enterprise_risk_category: "Information Security",
      impact_level: "medium",
    });

    const risks = await Risk.find({ assessment_id: assessment._id }).lean();
    const expectedSum = risks.reduce((sum, r) => sum + r.residual_score, 0);

    expect(second.overall_score).toBe(expectedSum);
    expect(first.residual_score + second.residual_score).toBe(expectedSum);

    const storedAssessment = await Assessment.findById(assessment._id);
    expect(storedAssessment?.overall_score).toBe(expectedSum);
  });

  it("updateRisk() recomputes both the risk residual_score and the assessment overall_score", async () => {
    await dbConnect();
    const assessment = await seedFixtures(60);
    const service = new AssessmentReviewService({ workspaceId });

    const raised = await service.raiseRisk(assessment._id.toString(), {
      control_id: "HOST-03",
      title: "Exposed admin panel",
      severity: "critical",
      enterprise_risk_category: "Information Security",
      impact_level: "critical",
      compensating_controls: [],
    });

    const updated = await service.updateRisk(raised.risk_id, {
      compensating_controls: ["IP allowlisting", "MFA"],
    });

    // A compensating control being added must strictly lower the residual score.
    expect(updated.residual_score).toBeLessThan(raised.residual_score);
    expect(updated.overall_score).toBe(updated.residual_score);

    const storedAssessment = await Assessment.findById(assessment._id);
    expect(storedAssessment?.overall_score).toBe(updated.residual_score);
  });

  it("updateRisk() can change status without altering the score inputs", async () => {
    await dbConnect();
    const assessment = await seedFixtures(60);
    const service = new AssessmentReviewService({ workspaceId });

    const raised = await service.raiseRisk(assessment._id.toString(), {
      control_id: "HOST-04",
      title: "Weak password policy",
      severity: "medium",
      enterprise_risk_category: "Information Security",
      impact_level: "medium",
    });

    const updated = await service.updateRisk(raised.risk_id, {
      status: "accepted",
    });
    expect(updated.residual_score).toBe(raised.residual_score);

    const storedRisk = await Risk.findById(raised.risk_id);
    expect(storedRisk?.status).toBe("accepted");
  });

  it("updateRisk() stamps closed_at when status moves to closed, and clears it if reopened (UI Revamp Round 2, DECISIONS.md 029)", async () => {
    await dbConnect();
    const assessment = await seedFixtures();
    const service = new AssessmentReviewService({ workspaceId });

    const raised = await service.raiseRisk(assessment._id.toString(), {
      control_id: "HOST-05",
      title: "Unpatched CVE",
      severity: "high",
      enterprise_risk_category: "Information Security",
      impact_level: "high",
    });

    await service.updateRisk(raised.risk_id, { status: "closed" });
    const closedRisk = await Risk.findById(raised.risk_id);
    expect(closedRisk?.status).toBe("closed");
    expect(closedRisk?.closed_at).toBeInstanceOf(Date);

    await service.updateRisk(raised.risk_id, { status: "open" });
    const reopenedRisk = await Risk.findById(raised.risk_id);
    expect(reopenedRisk?.status).toBe("open");
    expect(reopenedRisk?.closed_at).toBeNull();
  });

  it("completeReview() stamps the assessment completed with a reviewed_at timestamp and derives next_review_due from the vendor's tier cadence", async () => {
    await dbConnect();
    const assessment = await seedFixtures();
    const service = new AssessmentReviewService({ workspaceId });

    const result = await service.completeReview(assessment._id.toString());
    expect(result).toEqual({ ok: true, status: "completed" });

    const storedAssessment = await Assessment.findById(assessment._id);
    expect(storedAssessment?.status).toBe("completed");
    expect(storedAssessment?.reviewed_at).toBeInstanceOf(Date);

    // UI Revamp Round 2 (DECISIONS.md 029) — fixture vendor is tier 2, Workspace default
    // cadence for tier2 is 18 months (lib/db/models/workspace.ts default).
    expect(storedAssessment?.next_review_due).toBeInstanceOf(Date);
    const reviewedAt = storedAssessment!.reviewed_at!;
    const expected = new Date(
      reviewedAt.getFullYear(),
      reviewedAt.getMonth() + 18,
      reviewedAt.getDate(),
    );
    expect(storedAssessment?.next_review_due?.getTime()).toBe(
      expected.getTime(),
    );
  });

  it("completeReview() leaves next_review_due null when the vendor is unscored (no tier)", async () => {
    await dbConnect();
    const assessment = await seedFixtures();
    await Vendor.updateOne(
      { _id: vendorId },
      { $set: { inherent_risk_tier: null } },
    );
    const service = new AssessmentReviewService({ workspaceId });

    await service.completeReview(assessment._id.toString());

    const storedAssessment = await Assessment.findById(assessment._id);
    expect(storedAssessment?.next_review_due).toBeNull();
  });

  it("raiseRisk() rejects a request missing required fields before writing anything", async () => {
    await dbConnect();
    const assessment = await seedFixtures();
    const service = new AssessmentReviewService({ workspaceId });

    await expect(
      service.raiseRisk(
        assessment._id.toString(),
        // @ts-expect-error - intentionally omitting required fields (severity, category, impact_level)
        { control_id: "HOST-05", title: "Incomplete risk" },
      ),
    ).rejects.toThrow();

    const risks = await Risk.find({ assessment_id: assessment._id }).lean();
    expect(risks).toHaveLength(0);
  });

  it("listWorkspaceRisks() only returns risks for the requesting workspace, never another tenant", async () => {
    await dbConnect();
    const assessment = await seedFixtures();
    const service = new AssessmentReviewService({ workspaceId });

    await service.raiseRisk(assessment._id.toString(), {
      control_id: "HOST-06",
      title: "Cross-tenant isolation check",
      severity: "low",
      enterprise_risk_category: "Information Security",
      impact_level: "low",
    });

    const otherService = new AssessmentReviewService({
      workspaceId: otherWorkspaceId,
    });
    const otherResult = await otherService.listWorkspaceRisks();
    expect(otherResult.risks).toHaveLength(0);

    const ownResult = await service.listWorkspaceRisks();
    expect(ownResult.risks.map((r) => r.control_id)).toContain("HOST-06");
  });

  it("getAssessmentReviewData() throws NotFoundError for an assessment outside the caller workspace", async () => {
    await dbConnect();
    const assessment = await seedFixtures();
    const otherService = new AssessmentReviewService({
      workspaceId: otherWorkspaceId,
    });

    await expect(
      otherService.getAssessmentReviewData(assessment._id.toString()),
    ).rejects.toThrow();
  });

  /**
   * PLAN.md Phase 9: CAP tracking and mitigation guidance. `cap_tasks` stays embedded on
   * the risk (DECISIONS.md 006); these tests exercise the create/update/escalate surface
   * against a real MongoDB rather than trusting the arrayFilters update by inspection.
   */
  describe("CAP tasks", () => {
    async function raiseTestRisk(assessmentId: Types.ObjectId) {
      const service = new AssessmentReviewService({ workspaceId });
      const raised = await service.raiseRisk(assessmentId.toString(), {
        control_id: "HOST-07",
        title: "CAP test risk",
        severity: "high",
        enterprise_risk_category: "Information Security",
        impact_level: "high",
      });
      return { service, riskId: raised.risk_id };
    }

    afterEach(async () => {
      await User.deleteMany({ email: /cap-task-test\.example$/ });
    });

    it("createCapTask() with owner_type vendor always defaults owner_ref to the risk's own vendor", async () => {
      await dbConnect();
      const assessment = await seedFixtures();
      const { service, riskId } = await raiseTestRisk(assessment._id);

      const result = await service.createCapTask(riskId, {
        description: "Vendor to provide updated encryption evidence",
        owner_type: "vendor",
        // Deliberately a different, unrelated id — createCapTask() must ignore this for
        // owner_type 'vendor' and use the risk's own vendor_id instead.
        owner_ref: new Types.ObjectId().toString(),
        due_date: new Date("2020-01-01"),
      });

      expect(result.status).toBe("open");

      const storedRisk = await Risk.findById(riskId).lean();
      const task = storedRisk?.cap_tasks?.find(
        (t) => t.task_id?.toString() === result.task_id,
      );
      expect(task?.owner_type).toBe("vendor");
      expect(task?.owner_ref?.toString()).toBe(vendorId.toString());
      expect(task?.escalated_at).toBeNull();
    });

    it("createCapTask() with owner_type internal rejects a non-existent or inactive User", async () => {
      await dbConnect();
      const assessment = await seedFixtures();
      const { service, riskId } = await raiseTestRisk(assessment._id);

      await expect(
        service.createCapTask(riskId, {
          description: "Internal owner must fix config",
          owner_type: "internal",
          owner_ref: new Types.ObjectId().toString(),
          due_date: new Date("2099-01-01"),
        }),
      ).rejects.toThrow();

      const disabledUser = await User.create({
        email: "disabled-owner@cap-task-test.example",
        name: "Disabled Owner",
        password_hash: "x",
        status: "disabled",
      });

      await expect(
        service.createCapTask(riskId, {
          description: "Internal owner must fix config",
          owner_type: "internal",
          owner_ref: disabledUser._id.toString(),
          due_date: new Date("2099-01-01"),
        }),
      ).rejects.toThrow();
    });

    it("createCapTask() with owner_type internal succeeds for an active User", async () => {
      await dbConnect();
      const assessment = await seedFixtures();
      const { service, riskId } = await raiseTestRisk(assessment._id);

      const owner = await User.create({
        email: "active-owner@cap-task-test.example",
        name: "Active Owner",
        password_hash: "x",
        status: "active",
      });

      const result = await service.createCapTask(riskId, {
        description: "Owner must patch the vulnerable dependency",
        owner_type: "internal",
        owner_ref: owner._id.toString(),
        due_date: new Date("2099-01-01"),
      });

      const storedRisk = await Risk.findById(riskId).lean();
      const task = storedRisk?.cap_tasks?.find(
        (t) => t.task_id?.toString() === result.task_id,
      );
      expect(task?.owner_ref?.toString()).toBe(owner._id.toString());
    });

    it("updateCapTask() setting status to closed stamps closed_at", async () => {
      await dbConnect();
      const assessment = await seedFixtures();
      const { service, riskId } = await raiseTestRisk(assessment._id);

      const created = await service.createCapTask(riskId, {
        description: "Vendor remediation",
        owner_type: "vendor",
        due_date: new Date("2099-01-01"),
      });

      await service.updateCapTask(riskId, created.task_id, {
        status: "closed",
      });

      const storedRisk = await Risk.findById(riskId).lean();
      const task = storedRisk?.cap_tasks?.find(
        (t) => t.task_id?.toString() === created.task_id,
      );
      expect(task?.status).toBe("closed");
      expect(task?.closed_at).toBeInstanceOf(Date);
    });

    it("detectAndEscalateOverdueCaps() flips status to overdue and sends exactly one escalation, never repeating on a second run", async () => {
      await dbConnect();
      const assessment = await seedFixtures();
      const { service, riskId } = await raiseTestRisk(assessment._id);

      const created = await service.createCapTask(riskId, {
        description: "Vendor to close the finding",
        owner_type: "vendor",
        due_date: new Date("2020-01-01"), // deliberately in the past
      });

      const mailer = getMailer();
      const sendSpy = vi.spyOn(mailer, "send").mockResolvedValue(undefined);

      const firstRun = await service.detectAndEscalateOverdueCaps();
      const item = firstRun.find((i) => i.task_id === created.task_id);
      expect(item?.status).toBe("overdue");
      expect(item?.newly_escalated).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({ to: "spoc@review-test.example" }),
      );

      const storedRisk = await Risk.findById(riskId).lean();
      const storedTask = storedRisk?.cap_tasks?.find(
        (t) => t.task_id?.toString() === created.task_id,
      );
      expect(storedTask?.status).toBe("overdue");
      expect(storedTask?.escalated_at).toBeInstanceOf(Date);

      const secondRun = await service.detectAndEscalateOverdueCaps();
      const secondItem = secondRun.find((i) => i.task_id === created.task_id);
      expect(secondItem?.newly_escalated).toBe(false);
      // Still exactly one send total across both runs — escalation happens once, not once
      // per queue-page load.
      expect(sendSpy).toHaveBeenCalledTimes(1);

      sendSpy.mockRestore();
    });

    it("detectAndEscalateOverdueCaps() never surfaces a closed CAP task, even if its due date is past", async () => {
      await dbConnect();
      const assessment = await seedFixtures();
      const { service, riskId } = await raiseTestRisk(assessment._id);

      const created = await service.createCapTask(riskId, {
        description: "Already handled",
        owner_type: "vendor",
        due_date: new Date("2020-01-01"),
      });
      await service.updateCapTask(riskId, created.task_id, {
        status: "closed",
      });

      const mailer = getMailer();
      const sendSpy = vi.spyOn(mailer, "send").mockResolvedValue(undefined);

      const items = await service.detectAndEscalateOverdueCaps();
      expect(items.find((i) => i.task_id === created.task_id)).toBeUndefined();
      expect(sendSpy).not.toHaveBeenCalled();

      sendSpy.mockRestore();
    });
  });

  describe("archived-assessment immutability (Phase 10)", () => {
    it("refuses raiseRisk/updateRisk/createCapTask/updateCapTask once the assessment is archived", async () => {
      await dbConnect();
      const assessment = await seedFixtures();
      const service = new AssessmentReviewService({ workspaceId });

      const raised = await service.raiseRisk(assessment._id.toString(), {
        control_id: "HOST-05",
        title: "Pre-archive risk",
        severity: "high",
        enterprise_risk_category: "Information Security",
        impact_level: "high",
      });
      const capTask = await service.createCapTask(raised.risk_id, {
        description: "Pre-archive CAP task",
        owner_type: "vendor",
        due_date: new Date("2099-01-01"),
      });

      // Simulates what completeOffboarding() (lib/services/offboarding.ts) does — the
      // sole other writer of `status: 'archived'` — without pulling the whole offboarding
      // flow into this test file.
      await Assessment.updateOne(
        { _id: assessment._id },
        { $set: { status: "archived" } },
      );

      await expect(
        service.raiseRisk(assessment._id.toString(), {
          control_id: "HOST-06",
          title: "Post-archive risk",
          severity: "low",
          enterprise_risk_category: "Information Security",
          impact_level: "low",
        }),
      ).rejects.toThrow(/archived/);

      await expect(
        service.updateRisk(raised.risk_id, { status: "closed" }),
      ).rejects.toThrow(/archived/);

      await expect(
        service.createCapTask(raised.risk_id, {
          description: "Should be refused",
          owner_type: "vendor",
          due_date: new Date("2099-01-01"),
        }),
      ).rejects.toThrow(/archived/);

      await expect(
        service.updateCapTask(raised.risk_id, capTask.task_id, {
          status: "closed",
        }),
      ).rejects.toThrow(/archived/);

      // Confirm none of the refused calls actually wrote anything.
      const storedRisk = await Risk.findById(raised.risk_id).lean();
      expect(storedRisk?.status).toBe("open");
      expect(storedRisk?.cap_tasks).toHaveLength(1);
    });
  });
});
