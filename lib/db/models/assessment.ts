import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * template_snapshot is a frozen copy of the template's questions_schema at assignment time
 * — DECISIONS.md 007. This is what makes "render this historical assessment exactly as
 * answered" a property of the assessment document itself, independent of whether the
 * template later changes, archives, or is deleted.
 */
const assessmentSchema = new Schema(
  {
    workspace_id: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    engagement_id: {
      type: Schema.Types.ObjectId,
      ref: "Engagement",
      required: true,
    },
    vendor_id: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    template_id: {
      type: Schema.Types.ObjectId,
      ref: "QuestionnaireTemplate",
      required: true,
    },
    template_version: { type: Number, required: true },
    template_name: { type: String, default: null },
    template_snapshot: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: [
        "draft",
        "sent",
        "in_progress",
        "submitted",
        "under_review",
        "completed",
        "archived",
      ],
      default: "draft",
    },
    // Derived, never written directly — DECISIONS.md 008. risk.residual_score is
    // authoritative; this is recomputed from the assessment's risks in the same operation
    // that writes a risk. Nothing else may write this field.
    overall_score: { type: Number, default: null },
    assigned_at: { type: Date, default: null },
    submitted_at: { type: Date, default: null },
    reviewed_at: { type: Date, default: null },
    // Additive, UI Revamp Round 2 (DECISIONS.md 028/029) — analytics-only fields, no
    // existing writer or reader depended on their absence. Stage 3 leaves due_date null at
    // assignment; Stage 4 sets it on send from Workspace.settings.
    // assessment_response_sla_days. next_review_due is derived from
    // the vendor's tier cadence and stamped in completeReview(). Both null on assessments
    // created before this phase and on any assessment never reaching that step — analytics
    // reading these fields must treat null as "unknown", never default it to another date.
    due_date: { type: Date, default: null },
    next_review_due: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } as const },
);

assessmentSchema.index({ workspace_id: 1, engagement_id: 1 });
assessmentSchema.index({ workspace_id: 1, status: 1 });
assessmentSchema.index({ workspace_id: 1, vendor_id: 1, status: 1 });

export type AssessmentDoc = InferSchemaType<typeof assessmentSchema>;
export const Assessment: Model<AssessmentDoc> =
  models.Assessment ?? model<AssessmentDoc>("Assessment", assessmentSchema);
