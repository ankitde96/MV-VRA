import { env } from "@/lib/env";

/**
 * A second, independent stateless session type — deliberately not a generic reuse of
 * lib/auth/session.ts's payload shape. `FLOW.md` F2 gap (b): a portal session must never
 * satisfy an internal check or vice versa, and the strongest way to guarantee that is for
 * the two to be genuinely different code, not the same signer parameterized by a field
 * name. Same Web Crypto approach as lib/auth/session.ts, for the same Edge-runtime reason.
 */
export interface PortalSessionPayload {
  vendorId: string;
  workspaceId: string;
  /**
   * ASSESSMENT-WORKFLOW-PLAN.md Stage 2 (D8) — added here, ahead of Stage 4's first
   * reader, so every auth-touching change in this revamp lives in one stage rather than
   * two. Set once at OTP-verify time from the matched challenge/dev-bypass SPOC, never
   * from a request parameter — the same rule `vendorId` already follows.
   */
  spocId: string;
}

interface SignedPortalPayload extends PortalSessionPayload {
  exp: number;
}

// PLAN.md A2: "Vendor SPOCs use the portal rarely — a handful of sessions per assessment."
// A shorter TTL than the internal session is a stated assumption, not a spec requirement.
const PORTAL_SESSION_TTL_SECONDS = 60 * 60;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padding));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  // Signed with OTP_HMAC_SECRET, not SESSION_SECRET — another structural reason a portal
  // token can never verify against the internal session's signature, independent of the
  // payload shape check.
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.OTP_HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createPortalSessionToken(
  payload: PortalSessionPayload,
): Promise<string> {
  const signed: SignedPortalPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + PORTAL_SESSION_TTL_SECONDS,
  };
  const body = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(signed)),
  );
  const key = await getKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyPortalSessionToken(
  token: string | undefined | null,
): Promise<PortalSessionPayload | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const key = await getKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(signature) as BufferSource,
    new TextEncoder().encode(body) as BufferSource,
  );
  if (!valid) return null;

  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(body)),
    ) as Partial<SignedPortalPayload>;
    if (
      typeof parsed.exp !== "number" ||
      parsed.exp < Math.floor(Date.now() / 1000)
    )
      return null;
    if (
      typeof parsed.vendorId !== "string" ||
      typeof parsed.workspaceId !== "string" ||
      typeof parsed.spocId !== "string"
    )
      // Rejects any token signed before `spocId` existed — a pre-existing portal cookie
      // simply forces one re-login, which is cheap at this session's 1-hour TTL.
      return null;
    return {
      vendorId: parsed.vendorId,
      workspaceId: parsed.workspaceId,
      spocId: parsed.spocId,
    };
  } catch {
    return null;
  }
}
