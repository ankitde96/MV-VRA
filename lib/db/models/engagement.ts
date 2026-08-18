import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

const inherentScoreSchema = new Schema(
  {
    total: { type: Number, default: null },
    breakdown: { type: Schema.Types.Mixed, default: {} },
    weights_version: { type: Number, default: null },
    weights_snapshot: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const engagementSchema = new Schema(
  {
    workspace_id: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    vendor_id: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    business_owner_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    business_unit: { type: String, required: true },
    functional_scope: { type: String, required: true },
    expected_procurement_date: { type: Date, required: true },
    data_classification: {
      type: [String],
      enum: ["pii", "phi", "financial", "none"],
      default: [],
    },
    intake_responses: { type: Schema.Types.Mixed, default: {} },
    inherent_score: { type: inherentScoreSchema, default: () => ({}) },
    // No default — mirrors vendor.inherent_risk_tier. DECISIONS.md 008: an unscoreable
    // intake stays null and the engagement moves to scoring_failed, never a fabricated tier.
    inherent_risk_tier: { type: Number, enum: [1, 2, 3], default: null },
    status: {
      type: String,
      enum: [
        "draft",
        "submitted",
        "scoring_failed",
        "tiered",
        "in_assessment",
        "assessed",
        "offboarding",
        "closed",
      ],
      default: "draft",
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } as const },
);

engagementSchema.index({ workspace_id: 1, vendor_id: 1 });
engagementSchema.index({ workspace_id: 1, status: 1 });
engagementSchema.index({ workspace_id: 1, inherent_risk_tier: 1 });

export type EngagementDoc = InferSchemaType<typeof engagementSchema>;
export const Engagement: Model<EngagementDoc> =
  models.Engagement ?? model<EngagementDoc>("Engagement", engagementSchema);
