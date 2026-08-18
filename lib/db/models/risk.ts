import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * CAP tasks are embedded, not their own collection — DECISIONS.md 006. They are always
 * read with their parent risk and never queried independently of one; splitting them out
 * is the move to make later if CAP reporting ever needs to span risks, not a default now.
 */
const capTaskSchema = new Schema(
  {
    task_id: { type: Schema.Types.ObjectId, auto: true },
    description: { type: String, required: true },
    owner_type: { type: String, enum: ["internal", "vendor"], required: true },
    owner_ref: { type: Schema.Types.ObjectId, required: true },
    due_date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["open", "in_progress", "overdue", "closed"],
      default: "open",
    },
    closed_at: { type: Date, default: null },
    // Additive, Phase 9. Stamped the first time detectAndEscalateOverdueCaps() sends an
    // escalation for this task — makes "escalate once" possible without a job runner: a
    // request-driven re-check on every queue-page load must never re-send just because it
    // ran again. Existing (Phase 8) documents read this as null, which is exactly the "not
    // escalated yet" state, so no migration is needed.
    escalated_at: { type: Date, default: null },
  },
  { _id: false },
);

const riskSchema = new Schema(
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
    engagement_id: {
      type: Schema.Types.ObjectId,
      ref: "Engagement",
      required: true,
    },
    vendor_id: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    control_id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    severity: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      required: true,
    },
    enterprise_risk_category: { type: String, required: true },
    impact_level: { type: String, required: true },
    // Authoritative — DECISIONS.md 008. assessment.overall_score is derived from this and
    // recomputed in the same write; nothing else may write residual_score.
    residual_score: { type: Number, required: true },
    residual_inputs: { type: Schema.Types.Mixed, default: {} },
    cap_tasks: { type: [capTaskSchema], default: [] },
    status: {
      type: String,
      enum: ["open", "mitigating", "accepted", "closed"],
      default: "open",
    },
    // Additive, UI Revamp Round 2 (DECISIONS.md 028/029) — the risk itself never had a
    // closed timestamp; only cap_tasks[].closed_at existed (Phase 9). Stamped in
    // updateRisk() when status transitions to "closed", mirroring that existing pattern.
    // null on every risk closed before this phase, and analytics must treat that as
    // "unknown closure time", never backfill it from updated_at.
    closed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } as const },
);

riskSchema.index({ workspace_id: 1, status: 1, severity: 1 });
riskSchema.index({ workspace_id: 1, vendor_id: 1 });
riskSchema.index({
  workspace_id: 1,
  "cap_tasks.due_date": 1,
  "cap_tasks.status": 1,
});

export type RiskDoc = InferSchemaType<typeof riskSchema>;
export const Risk: Model<RiskDoc> =
  models.Risk ?? model<RiskDoc>("Risk", riskSchema);
