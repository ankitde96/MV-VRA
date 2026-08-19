import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { AssessmentRepository } from "@/lib/repositories/assessment-repository";
import { EngagementRepository } from "@/lib/repositories/engagement-repository";
import { TemplateRepository } from "@/lib/repositories/template-repository";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { WorkspaceRepository } from "@/lib/repositories/workspace-repository";
import { recordAuditEvent } from "@/lib/audit/record-event";
import { getMailer } from "@/lib/mail";
import type { TenantContext } from "@/lib/tenant/context";
import {
  questionsSchemaSchema,
  type QuestionsSchema,
} from "@/lib/questionnaire/schema";
import { validateQuestionsSchemaStructure } from "@/lib/questionnaire/validate-schema";

/**
 * PLAN.md Phase 6 item 1, `FLOW.md` F3 step 1-2. `template_snapshot` is a deep-cloned copy
 * of `questions_schema` at assignment time, not a reference (`DATA-MODEL.md` §3, "Why
 * snapshot rather than reference") — this assessment renders correctly forever even if the
 * template is later versioned or archived. Only a `published` template can be assigned;
 * every structural rule (`lib/questionnaire/validate-schema.ts`) was already enforced
 * before that template could reach `published`, so the snapshot can be trusted without
 * re-validating it here.
 */
export async function assignAssessment(
  ctx: TenantContext,
  actor: { userId: string },
  input: { vendorId: string; engagementId: string; templateId: string },
) {
  await dbConnect();
  const engagementRepo = new EngagementRepository(ctx);
  const templateRepo = new TemplateRepository(ctx);
  const assessmentRepo = new AssessmentRepository(ctx);

  const engagement = await engagementRepo.findById(input.engagementId);
  if (!engagement) {
    throw new NotFoundError(`Engagement ${input.engagementId} not found`);
  }
  if (engagement.vendor_id.toString() !== input.vendorId) {
    throw new ForbiddenError(
      `Engagement ${input.engagementId} does not belong to this vendor`,
    );
  }

  const template = await templateRepo.findById(input.templateId);
  if (!template) {
    throw new NotFoundError(`Template ${input.templateId} not found`);
  }
  if (template.status !== "published") {
    throw new ValidationError(
      `Template ${input.templateId} is ${template.status} — only a published template can be assigned`,
    );
  }

  const assignedAt = new Date();

  const session = await mongoose.startSession();
  try {
    const assessment = await session.withTransaction(async () => {
      const assessment = await assessmentRepo.create(
        {
          engagement_id: engagement._id,
          vendor_id: engagement.vendor_id,
          template_id: template._id,
          template_version: template.version,
          template_name: template.name,
          template_snapshot: structuredClone(template.questions_schema),
          status: "draft",
          assigned_at: assignedAt,
          due_date: null,
        },
        { session },
      );

      await recordAuditEvent(
        {
          workspace_id: engagement.workspace_id,
          actor: {
            type: "internal",
            id: new Types.ObjectId(actor.userId),
            email: null,
          },
          action: "assessment.assigned",
          entity_type: "assessment",
          entity_id: assessment._id,
          diff: {
            template_id: template._id,
            template_version: template.version,
          },
        },
        { session },
      );

      return assessment;
    });

    return assessment;
  } finally {
    await session.endSession();
  }
}

export async function updateAssessmentChecklist(
  ctx: TenantContext,
  actor: { userId: string },
  assessmentId: string,
  questionsSchema: QuestionsSchema,
  expectedUpdatedAt: Date,
) {
  await dbConnect();
  const parsed = questionsSchemaSchema.parse(questionsSchema);
  validateQuestionsSchemaStructure(parsed);

  const assessmentRepo = new AssessmentRepository(ctx);
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const result = await assessmentRepo.updateDraftSnapshot(
        assessmentId,
        parsed,
        expectedUpdatedAt,
        { session },
      );
      if (result.matchedCount === 0) {
        const assessment = await assessmentRepo.findByIdInSession(
          assessmentId,
          session,
        );
        if (!assessment) {
          throw new NotFoundError(`Assessment ${assessmentId} not found`);
        }
        throw new ForbiddenError(
          assessment.status !== "draft"
            ? "Only draft assessment checklists can be edited"
            : "This checklist changed in another session. Reload before saving again.",
        );
      }

      await recordAuditEvent(
        {
          workspace_id: new Types.ObjectId(ctx.workspaceId),
          actor: {
            type: "internal",
            id: new Types.ObjectId(actor.userId),
            email: null,
          },
          action: "assessment.checklist_updated",
          entity_type: "assessment",
          entity_id: new Types.ObjectId(assessmentId),
          diff: { section_count: parsed.sections.length },
        },
        { session },
      );

      return assessmentRepo.findByIdInSession(assessmentId, session);
    });
  } finally {
    await session.endSession();
  }
}

export async function sendAssessment(
  ctx: TenantContext,
  actor: { userId: string },
  assessmentId: string,
  input: { spocIds: string[] },
) {
  await dbConnect();
  const uniqueIds = [...new Set(input.spocIds)];
  if (
    uniqueIds.length === 0 ||
    uniqueIds.some((id) => !Types.ObjectId.isValid(id))
  ) {
    throw new ValidationError(
      "Choose at least one active questionnaire recipient",
    );
  }

  const assessmentRepo = new AssessmentRepository(ctx);
  const vendorRepo = new VendorRepository(ctx);
  const engagementRepo = new EngagementRepository(ctx);
  const workspaceRepo = new WorkspaceRepository();
  const assessment = await assessmentRepo.findById(assessmentId);
  if (!assessment)
    throw new NotFoundError(`Assessment ${assessmentId} not found`);
  if (assessment.status !== "draft") {
    throw new ForbiddenError("Only draft assessments can be sent");
  }
  const vendor = await vendorRepo.findById(assessment.vendor_id);
  if (!vendor)
    throw new NotFoundError(`Vendor ${assessment.vendor_id} not found`);
  const requested = new Set(uniqueIds);
  const recipients = vendor.spocs.filter(
    (spoc) => spoc.status === "active" && requested.has(spoc._id.toString()),
  );
  if (recipients.length !== uniqueIds.length) {
    throw new ValidationError(
      "Every recipient must be an active SPOC of this vendor",
    );
  }
  const workspace = await workspaceRepo.findById(ctx.workspaceId);
  const sentAt = new Date();
  const slaDays = workspace?.settings?.assessment_response_sla_days ?? 21;
  const dueDate = new Date(sentAt.getTime() + slaDays * 86_400_000);

  const session = await mongoose.startSession();
  let sent;
  try {
    sent = await session.withTransaction(async () => {
      const updated = await assessmentRepo.sendDraft(
        assessmentId,
        { recipients: recipients.map((spoc) => spoc._id), sentAt, dueDate },
        { session },
      );
      if (!updated)
        throw new ForbiddenError("Only draft assessments can be sent");
      await engagementRepo.updateOne(
        { _id: assessment.engagement_id },
        { $set: { status: "in_assessment" } },
        { session },
      );
      await recordAuditEvent(
        {
          workspace_id: new Types.ObjectId(ctx.workspaceId),
          actor: {
            type: "internal",
            id: new Types.ObjectId(actor.userId),
            email: null,
          },
          action: "assessment.sent",
          entity_type: "assessment",
          entity_id: assessment._id,
          diff: { recipients: recipients.map((spoc) => spoc._id) },
        },
        { session },
      );
      return updated;
    });
  } finally {
    await session.endSession();
  }

  await Promise.all(
    recipients.map((spoc) =>
      getMailer().send({
        to: spoc.email,
        subject: `Questionnaire ready: ${assessment.template_name ?? "Vendor assessment"}`,
        text: `A questionnaire is ready in the vendor portal. Please respond by ${dueDate.toISOString().slice(0, 10)}.`,
      }),
    ),
  );
  return sent;
}
