import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

const spocSchema = new Schema(
  {
    spoc_name: { type: String, required: true },
    spoc_email: { type: String, required: true, lowercase: true, trim: true },
    spoc_phone: { type: String, required: true },
  },
  { _id: false },
);

// Phase 4 (DECISIONS.md 017) — not in the original DATA-MODEL.md §2. Demo/harness storage
// consumer ahead of Phase 7's per-response evidence upload; `key` is opaque to callers and
// resolved only through lib/storage (CONSTRAINTS.md #10), never read or written directly.
const vendorDocumentSchema = new Schema(
  {
    key: { type: String, required: true },
    filename: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    uploaded_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploaded_at: { type: Date, required: true, default: Date.now },
  },
  { _id: true },
);

const vendorSchema = new Schema(
  {
    workspace_id: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    legal_name: { type: String, required: true },
    domain: { type: String, required: true, lowercase: true, trim: true },
    spoc: { type: spocSchema, required: true },
    business_unit: { type: String, trim: true, default: null },
    // No default. A scoring bug must surface as a visible null tier, not a fabricated Tier
    // 3 — DECISIONS.md 008. Do not add `default: 3` here under any circumstance.
    inherent_risk_tier: { type: Number, enum: [1, 2, 3], default: null },
    lifecycle_status: {
      type: String,
      enum: ["prospective", "active", "offboarding", "terminated"],
      default: "prospective",
    },
    documents: { type: [vendorDocumentSchema], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } as const },
);

vendorSchema.index({ workspace_id: 1, legal_name: 1 });
vendorSchema.index({ workspace_id: 1, domain: 1 }, { unique: true });
vendorSchema.index({
  workspace_id: 1,
  inherent_risk_tier: 1,
  lifecycle_status: 1,
});
// Deliberate exception to "workspace_id first in every index" — DATA-MODEL.md §2. OTP
// login resolves an email before any workspace is known, so this lookup cannot be
// workspace-prefixed. The OTP response must stay identical regardless of match (FLOW.md F2).
vendorSchema.index({ "spoc.spoc_email": 1 });

export type VendorDoc = InferSchemaType<typeof vendorSchema>;
export const Vendor: Model<VendorDoc> =
  models.Vendor ?? model<VendorDoc>("Vendor", vendorSchema);
