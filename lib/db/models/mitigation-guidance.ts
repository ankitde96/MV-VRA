import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * Global seed library, not tenant-scoped — DATA-MODEL.md §2. Every workspace reads the
 * same guidance; there is nothing per-tenant to isolate here.
 */
const mitigationGuidanceSchema = new Schema(
  {
    control_pattern: { type: String, required: true },
    failure_condition: { type: String, required: true },
    suggested_remediation: { type: String, required: true },
    references: { type: [String], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } as const },
);

mitigationGuidanceSchema.index({ control_pattern: 1 });

export type MitigationGuidanceDoc = InferSchemaType<
  typeof mitigationGuidanceSchema
>;
export const MitigationGuidance: Model<MitigationGuidanceDoc> =
  models.MitigationGuidance ??
  model<MitigationGuidanceDoc>("MitigationGuidance", mitigationGuidanceSchema);
