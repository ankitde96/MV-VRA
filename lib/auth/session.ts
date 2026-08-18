import { env } from "@/lib/env";

/**
 * A stateless, HMAC-signed session — no `sessions` collection exists (DATA-MODEL.md has
 * none), so a session is just a payload plus a signature the server can re-verify without a
 * database round trip. Deliberately built on Web Crypto (`crypto.subtle`) and
 * `btoa`/`atob`/`TextEncoder` rather than `node:crypto`/`Buffer` — those Node-specific APIs
 * are unavailable in the Edge runtime, and this module is imported by `middleware.ts`, which
 * Next.js may run on either runtime. Using only Web-standard APIs means this code works
 * regardless of which one Next.js chooses, now or after a future upgrade.
 */

export interface SessionPayload {
  userId: string;
  workspaceId: string;
}

interface SignedPayload extends SessionPayload {
  exp: number;
}

// 8 hours — "short-ish expiry" per PLAN.md Phase 2. Internal users re-authenticate daily
// rather than carrying a session for weeks.
const SESSION_TTL_SECONDS = 60 * 60 * 8;

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
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(
  payload: SessionPayload,
): Promise<string> {
  const signed: SignedPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
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

/**
 * Returns null for anything wrong with the token — missing, malformed, wrong signature, or
 * expired. Callers (middleware, route handlers) treat "invalid" and "expired" identically:
 * both mean "not logged in," never a distinct error a client could use to probe the token
 * format.
 */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
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
    ) as Partial<SignedPayload>;
    if (
      typeof parsed.exp !== "number" ||
      parsed.exp < Math.floor(Date.now() / 1000)
    )
      return null;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.workspaceId !== "string"
    )
      return null;
    return { userId: parsed.userId, workspaceId: parsed.workspaceId };
  } catch {
    return null;
  }
}
