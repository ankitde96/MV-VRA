// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Vendor } from "@/lib/db/models/vendor";
import { Engagement } from "@/lib/db/models/engagement";
import { Assessment } from "@/lib/db/models/assessment";
import { QuestionnaireTemplate } from "@/lib/db/models/questionnaire-template";
import { Workspace } from "@/lib/db/models/workspace";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  assignAssessment,
  sendAssessment,
  updateAssessmentChecklist,
} from "@/lib/services/assessment-assignment";
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
    const primaryId = new Types.ObjectId();
    const secondaryId = new Types.ObjectId();
    return Vendor.create({
      workspace_id: ws,
      legal_name: `Vendor ${domain}`,
      domain,
      spoc: {
        spoc_name: "Spoc",
        spoc_email: `spoc@${domain}`,
        spoc_phone: "+10000000000",
      },
      spocs: [
        {
          _id: primaryId,
          name: "Primary",
          email: `primary@${domain}`,
          phone: "+10000000001",
          is_primary: true,
          status: "active",
        },
        {
          _id: secondaryId,
          name: "Secondary",
          email: `secondary@${domain}`,
          phone: "+10000000002",
          is_primary: false,
          status: "active",
        },
      ],
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
      Workspace.deleteMany({ _id: { $in: [workspaceId, otherWorkspaceId] } }),
    ]);
  });

  it("sends a draft to selected active vendor SPOCs and advances the engagement", async () => {
    await dbConnect();
    await Workspace.create({
      _id: workspaceId,
      entity_name: "Send workspace",
      slug: `send-${workspaceId}`,
      settings: {
        tier_thresholds: { tier1_min: 70, tier2_min: 40 },
        assessment_response_sla_days: 10,
      },
    });
    const vendor = await createVendor(workspaceId, "send.example");
    const engagement = await createEngagement(workspaceId, vendor._id);
    const template = await createTemplate(
      workspaceId,
      "published",
      "send-draft",
    );
    const draft = await assignAssessment(
      { workspaceId },
      { userId: actorId.toString() },
      {
        vendorId: vendor._id.toString(),
        engagementId: engagement._id.toString(),
        templateId: template._id.toString(),
      },
    );

    const recipientId = vendor.spocs[1]!._id.toString();
    const sent = await sendAssessment(
      { workspaceId },
      { userId: actorId.toString() },
      draft._id.toString(),
      { spocIds: [recipientId] },
    );

    expect(sent?.status).toBe("sent");
    expect(sent?.recipients.map(String)).toEqual([recipientId]);
    expect(sent?.sent_at).toBeInstanceOf(Date);
    expect(sent?.last_activity_at).toEqual(sent?.sent_at);
    expect(sent!.due_date!.getTime() - sent!.sent_at!.getTime()).toBe(
      10 * 86_400_000,
    );
    expect((await Engagement.findById(engagement._id))?.status).toBe(
      "in_assessment",
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("assigns a published template as a draft without starting the response SLA", async () => {
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

    expect(assessment.status).toBe("draft");
    expect(assessment.template_name).toBe("Baseline");
    expect(assessment.template_version).toBe(1);
    expect(assessment.template_snapshot).toEqual(schema);

    expect(assessment.due_date).toBeNull();

    const storedEngagement = await Engagement.findById(engagement._id);
    expect(storedEngagement?.status).toBe("tiered");
  });

  it("edits only the assessment snapshot while it is draft", async () => {
    await dbConnect();
    const vendor = await createVendor(workspaceId, "snapshot-edit.example");
    const engagement = await createEngagement(workspaceId, vendor._id);
    const template = await createTemplate(
      workspaceId,
      "published",
      "snapshot-edit",
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
    const tailored: QuestionsSchema = {
      ...schema,
      sections: [
        {
          ...schema.sections[0]!,
          questions: [
            ...schema.sections[0]!.questions,
            {
              control_id: "Q2",
              text: "Tailored?",
              type: "text",
              required: false,
            },
          ],
        },
      ],
    };

    await updateAssessmentChecklist(
      { workspaceId },
      { userId: actorId.toString() },
      assessment._id.toString(),
      tailored,
      assessment.updated_at,
    );

    const [storedAssessment, storedTemplate] = await Promise.all([
      Assessment.findById(assessment._id).lean(),
      QuestionnaireTemplate.findById(template._id).lean(),
    ]);
    expect(storedAssessment?.template_snapshot).toEqual(tailored);
    expect(storedTemplate?.questions_schema).toEqual(schema);
  });

  it("refuses to edit a snapshot after the assessment is sent", async () => {
    await dbConnect();
    const vendor = await createVendor(workspaceId, "snapshot-sent.example");
    const engagement = await createEngagement(workspaceId, vendor._id);
    const template = await createTemplate(
      workspaceId,
      "published",
      "snapshot-sent",
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
    await Assessment.updateOne(
      { _id: assessment._id },
      { $set: { status: "sent" } },
    );

    await expect(
      updateAssessmentChecklist(
        { workspaceId },
        { userId: actorId.toString() },
        assessment._id.toString(),
        schema,
        assessment.updated_at,
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects invalid and forward-referencing schemas before changing the snapshot", async () => {
    await dbConnect();
    const vendor = await createVendor(workspaceId, "snapshot-invalid.example");
    const engagement = await createEngagement(workspaceId, vendor._id);
    const template = await createTemplate(
      workspaceId,
      "published",
      "snapshot-invalid",
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
    const forwardReference: QuestionsSchema = {
      schema_format_version: 1,
      sections: [
        {
          id: "sec",
          title: "Section",
          questions: [
            {
              control_id: "Q1",
              text: "First?",
              type: "text",
              required: true,
              show_if: {
                all: [{ control_id: "Q2", op: "eq", value: "yes" }],
              },
            },
            {
              control_id: "Q2",
              text: "Second?",
              type: "text",
              required: true,
            },
          ],
        },
      ],
    };

    await expect(
      updateAssessmentChecklist(
        { workspaceId },
        { userId: actorId.toString() },
        assessment._id.toString(),
        { schema_format_version: 1, sections: [] },
        assessment.updated_at,
      ),
    ).rejects.toThrow();
    await expect(
      updateAssessmentChecklist(
        { workspaceId },
        { userId: actorId.toString() },
        assessment._id.toString(),
        forwardReference,
        assessment.updated_at,
      ),
    ).rejects.toThrow(ValidationError);

    const stored = await Assessment.findById(assessment._id).lean();
    expect(stored?.template_snapshot).toEqual(schema);
  });

  it("starts a second assessment from the clean published template", async () => {
    await dbConnect();
    const vendor = await createVendor(workspaceId, "snapshot-second.example");
    const engagement = await createEngagement(workspaceId, vendor._id);
    const template = await createTemplate(
      workspaceId,
      "published",
      "snapshot-second",
    );
    const first = await assignAssessment(
      { workspaceId },
      { userId: actorId.toString() },
      {
        vendorId: vendor._id.toString(),
        engagementId: engagement._id.toString(),
        templateId: template._id.toString(),
      },
    );
    const tailored = structuredClone(schema);
    tailored.sections[0]!.questions[0]!.text = "Vendor-specific wording";
    await updateAssessmentChecklist(
      { workspaceId },
      { userId: actorId.toString() },
      first._id.toString(),
      tailored,
      first.updated_at,
    );

    const second = await assignAssessment(
      { workspaceId },
      { userId: actorId.toString() },
      {
        vendorId: vendor._id.toString(),
        engagementId: engagement._id.toString(),
        templateId: template._id.toString(),
      },
    );
    expect(second.template_snapshot).toEqual(schema);
  });

  it("refuses a stale concurrent checklist save instead of overwriting newer work", async () => {
    await dbConnect();
    const vendor = await createVendor(
      workspaceId,
      "snapshot-concurrent.example",
    );
    const engagement = await createEngagement(workspaceId, vendor._id);
    const template = await createTemplate(
      workspaceId,
      "published",
      "snapshot-concurrent",
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
    const firstEdit = structuredClone(schema);
    firstEdit.sections[0]!.questions[0]!.text = "First editor";
    const staleEdit = structuredClone(schema);
    staleEdit.sections[0]!.questions[0]!.text = "Stale editor";

    await updateAssessmentChecklist(
      { workspaceId },
      { userId: actorId.toString() },
      assessment._id.toString(),
      firstEdit,
      assessment.updated_at,
    );
    await expect(
      updateAssessmentChecklist(
        { workspaceId },
        { userId: actorId.toString() },
        assessment._id.toString(),
        staleEdit,
        assessment.updated_at,
      ),
    ).rejects.toThrow(/changed in another session/);

    const stored = await Assessment.findById(assessment._id).lean();
    expect(stored?.template_snapshot).toEqual(firstEdit);
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
