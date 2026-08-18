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
      // Additive, UI Revamp Round 2 (DECISIONS.md 029) — analytics config, not a scoring
      // input. reassessment_cadence_months drives the "reassessment overdue" KRI;
      // assessment_response_sla_days drives Assessment.due_date at assignment and the
      // "on-time completion" / "portal stall rate" KPIs. Defaults match DECISIONS.md 029's
      // recorded assumption (A3): Tier 1 annual, Tier 2 18mo, Tier 3 biennial, 21-day SLA.
      reassessment_cadence_months: {
        tier1: { type: Number, required: true, default: 12 },
        tier2: { type: Number, required: true, default: 18 },
        tier3: { type: Number, required: true, default: 24 },
      },
      assessment_response_sla_days: {
        type: Number,
        required: true,
        default: 21,
      },
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
