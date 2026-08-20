// @vitest-environment node
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { Vendor } from "@/lib/db/models/vendor";
import { Assessment } from "@/lib/db/models/assessment";
import { Response as ResponseModel } from "@/lib/db/models/response";
import { User } from "@/lib/db/models/user";
import { AuditEvent } from "@/lib/db/models/audit-event";
import { LocalFsStorageDriver } from "@/lib/storage/local-fs";
import {
  AssessmentEvidenceService,
  buildEvidenceManifest,
} from "@/lib/services/assessment-evidence";

describe("AssessmentEvidenceService (integration)", () => {
  const workspaceId = new Types.ObjectId();
  const otherWorkspaceId = new Types.ObjectId();
  const vendorId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const storagePrefix = `assessment-evidence-test-${randomUUID()}`;
  const storage = new LocalFsStorageDriver();

  async function seedAssessment({
    withEvidence = true,
    evidenceSize = 11,
  }: {
    withEvidence?: boolean;
    evidenceSize?: number;
  } = {}) {
    await dbConnect();
    await Workspace.create({
      _id: workspaceId,
      entity_name: "Evidence Test Workspace",
      slug: `evidence-test-${workspaceId.toString()}`,
      settings: {
        risk_weights: {},
        weights_version: 1,
        tier_thresholds: { tier1_min: 70, tier2_min: 40 },
        enterprise_risk_categories: [],
      },
      status: "active",
    });
    const vendor = await Vendor.create({
      _id: vendorId,
      workspace_id: workspaceId,
      legal_name: "Evidence Test Vendor",
      domain: `evidence-test-${vendorId.toString()}.example`,
      spoc: {
        spoc_name: "Evidence SPOC",
        spoc_email: "evidence-spoc@example.test",
        spoc_phone: "+1",
      },
      spocs: [
        {
          name: "Evidence SPOC",
          email: "evidence-spoc@example.test",
          phone: "+1",
          is_primary: true,
          status: "active",
        },
      ],
      inherent_risk_tier: 2,
      lifecycle_status: "active",
    });
    await User.create({
      _id: actorId,
      email: `evidence-actor-${workspaceId.toString()}@example.test`,
      name: "Evidence Reviewer",
      password_hash: "not-used",
      memberships: [{ workspace_id: workspaceId, role: "risk_analyst" }],
      status: "active",
    });
    const assessment = await Assessment.create({
      workspace_id: workspaceId,
      engagement_id: new Types.ObjectId(),
      vendor_id: vendorId,
      template_id: new Types.ObjectId(),
      template_version: 1,
      template_snapshot: {
        schema_format_version: 1,
        sections: [
          {
            id: "security",
            title: "Security / Controls",
            questions: [
              {
                control_id: "EV-1",
                text: "Provide security evidence",
                type: "text",
                required: true,
              },
            ],
          },
        ],
      },
      status: "submitted",
      overall_score: null,
      submitted_at: new Date(),
    });

    let response = null;
    if (withEvidence) {
      const key = `${storagePrefix}/proof.txt`;
      await storage.put(key, Buffer.from("hello world"));
      response = await ResponseModel.create({
        workspace_id: workspaceId,
        assessment_id: assessment._id,
        control_id: "EV-1",
        question_text: "Provide security evidence",
        response_value: "Attached",
        evidence: [
          {
            file_key: key,
            filename: "proof.txt",
            mime: "text/plain",
            size: evidenceSize,
            uploaded_at: new Date("2026-08-20T01:02:03.000Z"),
            uploaded_by: vendor.spocs[0]!._id,
          },
        ],
      });
    }
    return { assessment, response };
  }

  afterEach(async () => {
    await Promise.all([
      Workspace.deleteMany({ _id: { $in: [workspaceId, otherWorkspaceId] } }),
      Vendor.deleteMany({ workspace_id: workspaceId }),
      Assessment.deleteMany({ workspace_id: workspaceId }),
      ResponseModel.deleteMany({ workspace_id: workspaceId }),
      User.deleteMany({ "memberships.workspace_id": workspaceId }),
      AuditEvent.deleteMany({ workspace_id: workspaceId }),
    ]);
  });

  afterAll(async () => {
    await rm(resolve(process.cwd(), ".storage-local", storagePrefix), {
      recursive: true,
      force: true,
    });
    await mongoose.disconnect();
  });

  it("downloads only evidence resolved through the workspace-scoped response", async () => {
    const { assessment, response } = await seedAssessment();
    const evidenceId = response!.evidence[0]!._id!.toString();
    const service = new AssessmentEvidenceService({ workspaceId }, storage);

    const result = await service.getEvidenceFile(
      assessment._id.toString(),
      "EV-1",
      evidenceId,
    );
    expect(result.body.toString()).toBe("hello world");
    expect(result.evidence.filename).toBe("proof.txt");

    await expect(
      new AssessmentEvidenceService(
        { workspaceId: otherWorkspaceId },
        storage,
      ).getEvidenceFile(assessment._id.toString(), "EV-1", evidenceId),
    ).rejects.toThrow(/Assessment not found/);
  });

  it("atomically creates, replaces, and clears one advisory flag", async () => {
    const { assessment, response } = await seedAssessment();
    const evidenceId = response!.evidence[0]!._id!.toString();
    const service = new AssessmentEvidenceService({ workspaceId }, storage);

    await service.setEvidenceFlag(
      assessment._id.toString(),
      "EV-1",
      evidenceId,
      { flag: "insufficient", note: "Missing approval" },
      actorId.toString(),
    );
    await service.setEvidenceFlag(
      assessment._id.toString(),
      "EV-1",
      evidenceId,
      { flag: "insufficient", note: "Approval is illegible" },
      actorId.toString(),
    );
    let stored = await ResponseModel.findById(response!._id).lean();
    expect(stored?.evidence_flags).toHaveLength(1);
    expect(stored?.evidence_flags[0]?.note).toBe("Approval is illegible");

    await service.setEvidenceFlag(
      assessment._id.toString(),
      "EV-1",
      evidenceId,
      { flag: null },
      actorId.toString(),
    );
    stored = await ResponseModel.findById(response!._id).lean();
    expect(stored?.evidence_flags).toEqual([]);
  });

  it("assembles a streamed ZIP with safe paths and a manifest from local storage", async () => {
    const { assessment } = await seedAssessment();
    const service = new AssessmentEvidenceService({ workspaceId }, storage);
    const archive = await service.createArchive(assessment._id.toString());
    const body = Buffer.from(await new Response(archive.stream).arrayBuffer());

    expect(archive.fileCount).toBe(1);
    expect(archive.sourceBytes).toBe(11);
    expect(body.subarray(0, 2).toString()).toBe("PK");
    expect(
      body.includes(Buffer.from("Security - Controls/EV-1/proof.txt")),
    ).toBe(true);
    expect(body.includes(Buffer.from("manifest.csv"))).toBe(true);
    expect(
      buildEvidenceManifest([
        {
          path: "Security/EV-1/proof.txt",
          fileKey: "proof.txt",
          controlId: "EV-1",
          filename: "proof.txt",
          uploader: "Evidence SPOC",
          uploadedAt: new Date("2026-08-20T01:02:03.000Z"),
          insufficient: true,
          flagNote: 'Missing "approval"',
        },
      ]),
    ).toContain('"yes","Missing ""approval"""');
  });

  it("rejects an export when the assessment has no evidence", async () => {
    const { assessment: emptyAssessment } = await seedAssessment({
      withEvidence: false,
    });
    const service = new AssessmentEvidenceService({ workspaceId }, storage);
    await expect(
      service.createArchive(emptyAssessment._id.toString()),
    ).rejects.toThrow(/no evidence/i);
  });

  it("rejects evidence metadata above the configured ceiling", async () => {
    const { assessment: oversizedAssessment } = await seedAssessment({
      evidenceSize: 12,
    });
    const service = new AssessmentEvidenceService({ workspaceId }, storage);
    await expect(
      service.createArchive(oversizedAssessment._id.toString(), 10),
    ).rejects.toThrow(/exceeds the 10-byte limit/);
  });
});
