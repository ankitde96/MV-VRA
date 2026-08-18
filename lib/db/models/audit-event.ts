import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

const actorSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["internal", "vendor", "system"],
      required: true,
    },
    id: { type: Schema.Types.ObjectId, default: null },
    email: { type: String, default: null },
  },
  { _id: false },
);

/**
 * Append-only by design — CONSTRAINTS.md #12. The repository for this model (added when the
 * first mutating service lands) must expose no update or delete method at all, not just
 * decline to call one.
 */
const auditEventSchema = new Schema(
  {
    // Nullable for cross-workspace and system events (e.g. cross-workspace document
    // sharing reads) — DATA-MODEL.md §2.
    workspace_id: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    actor: { type: actorSchema, required: true },
    action: { type: String, required: true },
    entity_type: { type: String, required: true },
    entity_id: { type: Schema.Types.ObjectId, required: true },
    // Changed fields only, never raw PII/PHI values — CONSTRAINTS.md, assumption A4 in
    // PLAN.md §1.
    diff: { type: Schema.Types.Mixed, default: null },
    at: { type: Date, required: true, default: Date.now },
    request_ip: { type: String, default: null },
  },
  { timestamps: false },
);

auditEventSchema.index({ workspace_id: 1, at: -1 });
auditEventSchema.index({ entity_type: 1, entity_id: 1, at: -1 });

export type AuditEventDoc = InferSchemaType<typeof auditEventSchema>;
export const AuditEvent: Model<AuditEventDoc> =
  models.AuditEvent ?? model<AuditEventDoc>("AuditEvent", auditEventSchema);
