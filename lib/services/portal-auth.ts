import { dbConnect } from "@/lib/db/connect";
import { RateLimitedError, UnauthorizedError } from "@/lib/errors";
import { recordAuditEvent } from "@/lib/audit/record-event";
import { getMailer } from "@/lib/mail";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import {
  constantTimeEqual,
  hashOtpCode,
  OTP_MAX_ATTEMPTS,
} from "@/lib/auth/otp";
import {
  consumeOtpChallenge,
  dummyOtpLookupForTiming,
  findActiveChallenge,
  findVendorBySpocEmail,
  incrementOtpAttempts,
  issueOtpChallenge,
} from "@/lib/auth/otp-challenge";
import type { PortalSessionPayload } from "@/lib/auth/portal-session";

// PLAN.md Phase 6 item 5 — not spec numbers, a stated assumption (DECISIONS.md, this
// phase's entry): generous enough that a real SPOC re-requesting a code a few times in ten
// minutes never gets blocked, tight enough to slow a brute-force enumeration script.
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const OTP_REQUEST_MAX_PER_EMAIL = 5;
const OTP_REQUEST_MAX_PER_IP = 20;

/**
 * `PLAN.md` Phase 6 item 2: identical response body **and** comparable timing whether or
 * not `email` matches a vendor SPOC — the caller (the API route) must render the exact
 * same success response regardless of what happens inside here. Never throws for "no such
 * vendor"; only rate-limiting throws, and it throws identically for a real or fake email
 * (rate limiting is a function of request volume, not vendor existence, so it doesn't
 * reopen the enumeration gap it isn't trying to close).
 */
export async function requestOtp(input: {
  email: string;
  requestIp: string | null;
}): Promise<void> {
  const normalizedEmail = input.email.trim().toLowerCase();

  if (
    !checkRateLimit(
      `otp:email:${normalizedEmail}`,
      OTP_REQUEST_MAX_PER_EMAIL,
      OTP_REQUEST_WINDOW_MS,
    )
  ) {
    throw new RateLimitedError(
      "Too many verification code requests. Try again later.",
    );
  }
  if (
    input.requestIp &&
    !checkRateLimit(
      `otp:ip:${input.requestIp}`,
      OTP_REQUEST_MAX_PER_IP,
      OTP_REQUEST_WINDOW_MS,
    )
  ) {
    throw new RateLimitedError(
      "Too many verification code requests. Try again later.",
    );
  }

  await dbConnect();
  const vendor = await findVendorBySpocEmail(normalizedEmail);
  if (!vendor) {
    await dummyOtpLookupForTiming();
    return;
  }

  const { code } = await issueOtpChallenge({
    email: normalizedEmail,
    vendorId: vendor._id,
    workspaceId: vendor.workspace_id,
    requestIp: input.requestIp,
  });

  await getMailer().send({
    to: vendor.spoc.spoc_email,
    subject: "Your MV-VRA verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
  });

  await recordAuditEvent({
    workspace_id: vendor.workspace_id,
    actor: { type: "vendor", id: vendor._id, email: normalizedEmail },
    action: "vendor_portal.otp_requested",
    entity_type: "vendor",
    entity_id: vendor._id,
    request_ip: input.requestIp,
  });
}

/**
 * `PLAN.md` Phase 6 item 3: single generic failure (`UnauthorizedError`) covers "no active
 * challenge," "expired," "attempt limit reached," and "wrong code" — the caller cannot
 * distinguish which. Success consumes the challenge (single-use, no replay) and returns
 * the session payload for the route to sign and set as a cookie; `vendorId`/`workspaceId`
 * come from the challenge document, never from the request body.
 */
export async function verifyOtp(input: {
  email: string;
  code: string;
}): Promise<PortalSessionPayload> {
  await dbConnect();
  const challenge = await findActiveChallenge(input.email);

  if (!challenge || challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw new UnauthorizedError("Invalid or expired verification code.");
  }

  const submittedHash = await hashOtpCode(input.code);
  if (!constantTimeEqual(submittedHash, challenge.code_hash)) {
    await incrementOtpAttempts(challenge._id);
    throw new UnauthorizedError("Invalid or expired verification code.");
  }

  await consumeOtpChallenge(challenge._id);

  await recordAuditEvent({
    workspace_id: challenge.workspace_id,
    actor: { type: "vendor", id: challenge.vendor_id, email: challenge.email },
    action: "vendor_portal.login_succeeded",
    entity_type: "vendor",
    entity_id: challenge.vendor_id,
  });

  return {
    vendorId: challenge.vendor_id.toString(),
    workspaceId: challenge.workspace_id.toString(),
  };
}
