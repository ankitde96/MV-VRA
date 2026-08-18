import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * Internal users only. Vendor SPOCs are never represented here — they live on the vendor
 * document and authenticate by OTP (see otp-challenge.ts). Keeping the two separate means
 * there is no code path where a vendor could be resolved into an internal principal.
 */
const membershipSchema = new Schema(
  {
    workspace_id: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "risk_analyst", "business_owner", "viewer"],
      required: true,
    },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    // argon2 hash — never plaintext, never logged. Populated in Phase 2.
    password_hash: { type: String, required: true },
    memberships: { type: [membershipSchema], default: [] },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } as const },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ "memberships.workspace_id": 1 });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User: Model<UserDoc> =
  models.User ?? model<UserDoc>("User", userSchema);
