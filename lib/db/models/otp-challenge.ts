import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * workspace_id and vendor_id are resolved server-side at issue time from the matched
 * vendor SPOC email — never accepted from the client. The TTL index below deletes expired
 * documents automatically, but the sweep runs up to 60s late, so Phase 6's verify logic
 * must still compare expires_at explicitly rather than relying on the document's absence.
 */
const otpChallengeSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    vendor_id: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    workspace_id: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    code_hash: { type: String, required: true },
    expires_at: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumed_at: { type: Date, default: null },
    request_ip: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } as const },
);

otpChallengeSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
otpChallengeSchema.index({ email: 1, created_at: -1 });

export type OtpChallengeDoc = InferSchemaType<typeof otpChallengeSchema>;
export const OtpChallenge: Model<OtpChallengeDoc> =
  models.OtpChallenge ??
  model<OtpChallengeDoc>("OtpChallenge", otpChallengeSchema);
