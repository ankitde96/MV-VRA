import { env } from "@/lib/env";

/**
 * PLAN.md Phase 6, `DATA-MODEL.md` §2 `otp_challenges`. Constants here aren't from the
 * spec — DECISIONS.md records them as stated assumptions, not requirements:
 * 6-digit code, 10-minute TTL, 5 verify attempts, matching the general "keep it simple,
 * make it correctable" posture the rest of the plan takes with unspecified numbers.
 *
 * Web Crypto (`crypto.subtle`), not `node:crypto` — same rationale as lib/auth/session.ts:
 * this module is reachable from route handlers that may run on either the Node or Edge
 * runtime, and Web Crypto works on both without a branch.
 */
export const OTP_TTL_SECONDS = 60 * 10;
export const OTP_MAX_ATTEMPTS = 5;
const OTP_CODE_LENGTH = 6;

export function generateOtpCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const value = new DataView(bytes.buffer).getUint32(0);
  return String(value % 10 ** OTP_CODE_LENGTH).padStart(OTP_CODE_LENGTH, "0");
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.OTP_HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function hashOtpCode(code: string): Promise<string> {
  const key = await getKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(code),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Fixed-length hex digests (both from the same HMAC-SHA256), so a simple XOR-accumulate
 * loop over equal-length strings is a genuine constant-time comparison — no early-return
 * short-circuit that would leak how many leading characters matched.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
