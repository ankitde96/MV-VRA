import { Types } from "mongoose";
import { Vendor } from "@/lib/db/models/vendor";
import {
  OtpChallenge,
  type OtpChallengeDoc,
} from "@/lib/db/models/otp-challenge";
import { generateOtpCode, hashOtpCode, OTP_TTL_SECONDS } from "./otp";

/**
 * Not a `TenantRepository` subclass, deliberately — same reasoning as
 * lib/audit/record-event.ts. `DATA-MODEL.md` §2: OTP login resolves an email to a vendor
 * *before* any workspace is known, so there is no `TenantContext` to construct one with
 * yet.
 *
 * ASSESSMENT-WORKFLOW-PLAN.md Stage 2 (D2) — resolves against `spocs[]`, not the legacy
 * single `spoc` object; only an `active` SPOC can authenticate. Returns the matched SPOC
 * alongside the vendor so the caller can scope the challenge/session to that one person,
 * not just the vendor. `{ "spocs.email": ... }` is the one other index in the schema that
 * is deliberately not workspace-prefixed, for the same reason as the legacy index.
 */
export async function findVendorBySpocEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const vendor = await Vendor.findOne({
    spocs: { $elemMatch: { email: normalized, status: "active" } },
  });
  if (!vendor) return null;
  const spoc = vendor.spocs.find(
    (s) => s.email === normalized && s.status === "active",
  );
  // Defensive only — the query above already guarantees a match exists.
  if (!spoc) return null;
  return { vendor, spocId: spoc._id as Types.ObjectId };
}

/**
 * Generates and persists a challenge, returning the plaintext code for the caller to
 * email — the code is never stored, only its HMAC (`code_hash`).
 */
export async function issueOtpChallenge(params: {
  email: string;
  vendorId: Types.ObjectId;
  spocId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  requestIp: string | null;
}): Promise<{
  code: string;
  challenge: OtpChallengeDoc & { _id: Types.ObjectId };
}> {
  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);

  const challenge = await OtpChallenge.create({
    email: params.email.trim().toLowerCase(),
    vendor_id: params.vendorId,
    spoc_id: params.spocId,
    workspace_id: params.workspaceId,
    code_hash: codeHash,
    expires_at: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
    attempts: 0,
    consumed_at: null,
    request_ip: params.requestIp,
  });

  return { code, challenge };
}

/**
 * A harmless read of roughly the same shape as `issueOtpChallenge`'s write, run on the
 * "email doesn't match any vendor" path so a timing-based observer sees a comparable delay
 * either way — `PLAN.md` Phase 6 item 2. This is a best-effort mitigation, not a
 * cryptographic constant-time guarantee (`DECISIONS.md`, this phase's entry).
 */
export async function dummyOtpLookupForTiming(): Promise<void> {
  await OtpChallenge.findOne({ _id: new Types.ObjectId() });
}

/**
 * `expires_at: { $gt: now }` is checked here explicitly, not left to the TTL index —
 * `DATA-MODEL.md` §2: the TTL sweep runs up to 60s late, so an expired-but-not-yet-deleted
 * document must never be treated as active.
 */
export async function findActiveChallenge(email: string) {
  return OtpChallenge.findOne({
    email: email.trim().toLowerCase(),
    consumed_at: null,
    expires_at: { $gt: new Date() },
  }).sort({ created_at: -1 });
}

export async function incrementOtpAttempts(
  challengeId: Types.ObjectId,
): Promise<void> {
  await OtpChallenge.updateOne({ _id: challengeId }, { $inc: { attempts: 1 } });
}

/** Single-use: consuming a challenge is what makes replaying a correct code impossible. */
export async function consumeOtpChallenge(
  challengeId: Types.ObjectId,
): Promise<void> {
  await OtpChallenge.updateOne(
    { _id: challengeId },
    { $set: { consumed_at: new Date() } },
  );
}
