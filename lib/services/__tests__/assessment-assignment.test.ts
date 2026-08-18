// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Vendor } from "@/lib/db/models/vendor";
import { Engagement } from "@/lib/db/models/engagement";
import { Assessment } from "@/lib/db/models/assessment";
import { QuestionnaireTemplate } from "@/lib/db/models/questionnaire-template";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { assignAssessment } from "@/lib/services/assessment-assignment";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";

const schema: QuestionsSchema = {
  schema_format_version: 1,
  sections: [
    {
      id: "sec_1",
      title: "Section 1",
      questions: [
        { control_id: "Q1", text: "Q1?", type: "text", required: true },
      ],
    },
  ],
};

/**
 * TEST-CHECKLIST.md Gate 2/5: verified against a real database and a real transaction.
 * DATA-MODEL.md §3's "why snapshot rather than reference" is the thing under test — the
 * assessment must carry its own frozen copy, not a pointer.
 */
describe("assignAssessment (integration)", () => {
  const workspaceId = new Types.ObjectId();
  const otherWorkspaceId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const businessOwnerId = new Types.ObjectId();

  async function createVendor(ws: Types.ObjectId, domain: string) {
    return Vendor.create({
      workspace_id: ws,
      legal_name: `Vendor ${domain}`,
      domain,
      spoc: {
        spoc_name: "Spoc",
        spoc_email: `spoc@${domain}`,
        spoc_phone: "+10000000000",
      },
    });
  }

  async function createEngagement(
    ws: Types.ObjectId,
    vendorId: Types.ObjectId,
  ) {
    return Engagement.create({
      workspace_id: ws,
      vendor_id: vendorId,
      business_owner_id: businessOwnerId,
      business_unit: "Engineering",
      functional_scope: "Testing",
      expected_procurement_date: new Date("2026-09-01"),
      status: "tiered",
    });
  }

  async function createTemplate(
    ws: Types.ObjectId,
    status: "draft" | "published" | "archived",
    templateKey: string,
  ) {
    return QuestionnaireTemplate.create({
      workspace_id: ws,
      template_key: templateKey,
      version: 1,
      name: "Baseline",
      description: "",
      status,
      questions_schema: schema,
      schema_format_version: 1,
      published_at: status === "published" ? new Date() : null,
    });
  }

  afterEach(async () => {
    await Promise.all([
      Vendor.deleteMany({
        workspace_id: { $in: [workspaceId, otherWorkspaceId] },
      }),
      Engagement.deleteMany({
        workspace_id: { $in: [workspaceId, otherWorkspaceId] },
      }),
      Assessment.deleteMany({
        workspace_id: { $in: [workspaceId, otherWorkspaceId] },
      }),
      QuestionnaireTemplate.deleteMany({
        workspace_id: { $in: [workspaceId, otherWorkspaceId] },
      }),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("assigns a published template, snapshotting its schema and bumping the engagement to in_assessment", async () => {
    await dbConnect();
    const vendor = await createVendor(workspaceId, "assign.example");
    const engagement = await createEngagement(workspaceId, vendor._id);
    const template = await createTemplate(
      workspaceId,
      "published",
      "baseline-assign",
    );

    const assessment = await assignAssessment(
      { workspaceId },
      { userId: actorId.toString() },
      {
        vendorId: vendor._id.toString(),
        engagementId: engagement._id.toString(),
        templateId: template._id.toString(),
      },
    );

    expect(assessment.status).toBe("sent");
    expect(assessment.template_version).toBe(1);
    expect(assessment.template_snapshot).toEqual(schema);

    const storedEngagement = await Engagement.findById(engagement._id);
    expect(storedEngagement?.status).toBe("in_assessment");
  });

  it("rejects assigning a draft template", async () => {
    await dbConnect();
    const vendor = await createVendor(workspaceId, "draft-reject.example");
    const engagement = await createEngagement(workspaceId, vendor._id);
    const template = await createTemplate(
      workspaceId,
      "draft",
      "baseline-draft",
    );

    await expect(
      assignAssessment(
        { workspaceId },
        { userId: actorId.toString() },
        {
          vendorId: vendor._id.toString(),
          engagementId: engagement._id.toString(),
          templateId: template._id.toString(),
        },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects assigning an archived template", async () => {
    await dbConnect();
    const vendor = await createVendor(workspaceId, "archived-reject.example");
    const engagement = await createEngagement(workspaceId, vendor._id);
    const template = await createTemplate(
      workspaceId,
      "archived",
      "baseline-archived",
    );

    await expect(
      assignAssessment(
        { workspaceId },
        { userId: actorId.toString() },
        {
          vendorId: vendor._id.toString(),
          engagementId: engagement._id.toString(),
          templateId: template._id.toString(),
        },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects when the engagement does not belong to the given vendor", async () => {
    await dbConnect();
    const vendorA = await createVendor(workspaceId, "vendor-a.example");
    const vendorB = await createVendor(workspaceId, "vendor-b.example");
    const engagementForB = await createEngagement(workspaceId, vendorB._id);
    const template = await createTemplate(
      workspaceId,
      "published",
      "baseline-mismatch",
    );

    await expect(
      assignAssessment(
        { workspaceId },
        { userId: actorId.toString() },
        {
          vendorId: vendorA._id.toString(),
          engagementId: engagementForB._id.toString(),
          templateId: template._id.toString(),
        },
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects an engagement id that belongs to a different workspace (tenant isolation)", async () => {
    await dbConnect();
    const vendor = await createVendor(workspaceId, "tenant-a.example");
    const otherVendor = await createVendor(
      otherWorkspaceId,
      "tenant-b.example",
    );
    const otherEngagement = await createEngagement(
      otherWorkspaceId,
      otherVendor._id,
    );
    const template = await createTemplate(
      workspaceId,
      "published",
      "baseline-tenant",
    );

    await expect(
      assignAssessment(
        { workspaceId },
        { userId: actorId.toString() },
        {
          vendorId: vendor._id.toString(),
          engagementId: otherEngagement._id.toString(),
          templateId: template._id.toString(),
        },
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
