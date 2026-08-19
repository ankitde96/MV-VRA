import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

// `_id: true` (Phase 7) — not in the original DATA-MODEL.md §2 field list, added once the
// evidence-download route needed to address one evidence item within the array, the same
// need Phase 4's `Vendor.documents` already solved the same way.
const evidenceFileSchema = new Schema(
  {
    file_key: { type: String, required: true },
    filename: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    uploaded_at: { type: Date, required: true },
    uploaded_by: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: true },
);

// REVIEWER-EXPERIENCE-PLAN.md Stage 1 — advisory reviewer annotations on individual
// evidence items. These do not alter a response verdict or gate review completion.
const evidenceFlagSchema = new Schema(
  {
    evidence_id: { type: Schema.Types.ObjectId, required: true },
    flag: { type: String, enum: ["insufficient"], required: true },
    note: { type: String, default: "" },
    flagged_at: { type: Date, required: true },
    flagged_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false },
);

const responseSchema = new Schema(
  {
    workspace_id: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    assessment_id: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    control_id: { type: String, required: true },
    question_text: { type: String, required: true },
    response_value: { type: Schema.Types.Mixed, default: null },
    evidence: { type: [evidenceFileSchema], default: [] },
    evidence_flags: { type: [evidenceFlagSchema], default: [] },
    // DATA-MODEL.md §2 calls this load-bearing for the suppressed-vs-skipped distinction,
    // but Phase 7's validator (lib/services/portal-assessment.ts, submitAssessment())
    // recomputes visibility fresh via computeVisibility() at submission time instead of
    // reading this field — DECISIONS.md 020. This column is never written; always `false`.
    // Do not trust it for that distinction without recomputing visibility yourself.
    is_suppressed: { type: Boolean, default: false },
    is_failed: { type: Boolean, default: false },
    has_exception: { type: Boolean, default: false },
    answered_at: { type: Date, default: null },
    answered_by: { type: Schema.Types.ObjectId, default: null },
    review_status: {
      type: String,
      enum: ["compliant", "non_compliant"],
      default: null,
    },
    reviewer_note: { type: String, default: "" },
    reviewed_at: { type: Date, default: null },
    reviewed_by: { type: Schema.Types.ObjectId, default: null },
    review_round: { type: Number, default: 0 },
  },
  { timestamps: false },
);

// Uniqueness is what makes portal autosave an idempotent upsert — DATA-MODEL.md §2.
responseSchema.index(
  { workspace_id: 1, assessment_id: 1, control_id: 1 },
  { unique: true },
);

export type ResponseDoc = InferSchemaType<typeof responseSchema>;
export const Response: Model<ResponseDoc> =
  models.Response ?? model<ResponseDoc>("Response", responseSchema);
