import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { AssessmentRepository } from "@/lib/repositories/assessment-repository";
import { EngagementRepository } from "@/lib/repositories/engagement-repository";
import { TemplateRepository } from "@/lib/repositories/template-repository";
import { recordAuditEvent } from "@/lib/audit/record-event";
import type { TenantContext } from "@/lib/tenant/context";

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

  const session = await mongoose.startSession();
  try {
    const assessment = await session.withTransaction(async () => {
      const assessment = await assessmentRepo.create(
        {
          engagement_id: engagement._id,
          vendor_id: engagement.vendor_id,
          template_id: template._id,
          template_version: template.version,
          template_snapshot: structuredClone(template.questions_schema),
          status: "sent",
          assigned_at: new Date(),
        },
        { session },
      );

      await engagementRepo.updateOne(
        { _id: engagement._id },
        { $set: { status: "in_assessment" } },
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
