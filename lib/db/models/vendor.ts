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

/**
 * ASSESSMENT-WORKFLOW-PLAN.md Stage 2 (D2, DECISIONS.md 040/042) — replaces the single
 * embedded `spoc` above as the source of truth for portal login and recipient scoping.
 * `spoc` (above) is left in place, unwritten by anything new, rather than deleted —
 * CONSTRAINTS.md #3, DATA-MODEL.md §6 forbid repurposing a field in place. `_id: true`
 * (default) because a SPOC's own id is the recipient reference Stage 4 will use.
 */
const spocEntrySchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    is_primary: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { _id: true },
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
    spocs: { type: [spocEntrySchema], default: [] },
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
// Same deliberate exception, for the spocs[] array OTP login now actually resolves
// against — Stage 2. Kept alongside the legacy index above until that field is dropped.
vendorSchema.index({ "spocs.email": 1 });

export type VendorDoc = InferSchemaType<typeof vendorSchema>;
export const Vendor: Model<VendorDoc> =
  models.Vendor ?? model<VendorDoc>("Vendor", vendorSchema);
