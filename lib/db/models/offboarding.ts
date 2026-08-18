import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

const checklistItemSchema = new Schema(
  {
    item_id: { type: Schema.Types.ObjectId, auto: true },
    label: { type: String, required: true },
    owner_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "in_progress", "done"],
      default: "pending",
    },
    completed_at: { type: Date, default: null },
  },
  { _id: false },
);

const certificateSchema = new Schema(
  {
    file_key: { type: String, required: true },
    uploaded_at: { type: Date, required: true },
    verified_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verified_at: { type: Date, default: null },
  },
  { _id: false },
);

const offboardingSchema = new Schema(
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
    checklist: { type: [checklistItemSchema], default: [] },
    destruction_certificate: { type: certificateSchema, default: null },
    asset_return_attestation: { type: certificateSchema, default: null },
    status: {
      type: String,
      enum: ["initiated", "in_progress", "verified", "archived"],
      default: "initiated",
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } as const },
);

offboardingSchema.index(
  { workspace_id: 1, engagement_id: 1 },
  { unique: true },
);
offboardingSchema.index({ workspace_id: 1, status: 1 });

export type OffboardingDoc = InferSchemaType<typeof offboardingSchema>;
export const Offboarding: Model<OffboardingDoc> =
  models.Offboarding ?? model<OffboardingDoc>("Offboarding", offboardingSchema);
