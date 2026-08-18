import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * The one sanctioned cross-tenant read path — DATA-MODEL.md §2. `shared_with` carries its
 * own explicit grant list rather than relying on the reader's own workspace_id, and every
 * read through it must write an audit_events entry (enforced by the repository/service that
 * reads this, not by this schema).
 */
const sharedDocumentSchema = new Schema(
  {
    owner_workspace_id: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    vendor_domain: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    document_ref: { type: Schema.Types.Mixed, required: true },
    shared_with: {
      type: [Schema.Types.ObjectId],
      ref: "Workspace",
      default: [],
    },
    granted_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    granted_at: { type: Date, required: true, default: Date.now },
    expires_at: { type: Date, default: null },
  },
  { timestamps: false },
);

sharedDocumentSchema.index({ vendor_domain: 1, shared_with: 1 });

export type SharedDocumentDoc = InferSchemaType<typeof sharedDocumentSchema>;
export const SharedDocument: Model<SharedDocumentDoc> =
  models.SharedDocument ??
  model<SharedDocumentDoc>("SharedDocument", sharedDocumentSchema);
