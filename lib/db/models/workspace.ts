import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * Root of all isolation (DATA-MODEL.md §2). Deliberately NOT tenant-scoped — a workspace
 * document *is* the tenant, there is nothing above it to filter by.
 */
const riskWeightsSchema = new Schema(
  {
    data_classification: { type: Schema.Types.Mixed, default: {} },
    network_exposure: { type: Schema.Types.Mixed, default: {} },
    system_access_level: { type: Schema.Types.Mixed, default: {} },
    business_redundancy: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const workspaceSchema = new Schema(
  {
    entity_name: { type: String, required: true },
    slug: { type: String, required: true },
    parent_workspace_id: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    settings: {
      risk_weights: { type: riskWeightsSchema, default: () => ({}) },
      // Bumped on any weight change, never reused — DATA-MODEL.md §4. Engagements snapshot
      // this value so a historical score stays explainable after weights change later.
      weights_version: { type: Number, required: true, default: 1 },
      tier_thresholds: {
        tier1_min: { type: Number, required: true },
        tier2_min: { type: Number, required: true },
      },
      enterprise_risk_categories: { type: [String], default: [] },
    },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } as const },
);

workspaceSchema.index({ slug: 1 }, { unique: true });
workspaceSchema.index({ parent_workspace_id: 1 });

export type WorkspaceDoc = InferSchemaType<typeof workspaceSchema>;
export const Workspace: Model<WorkspaceDoc> =
  models.Workspace ?? model<WorkspaceDoc>("Workspace", workspaceSchema);
