import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { env } from "@/lib/env";

describe("session token", () => {
  it("round-trips a valid payload", async () => {
    const token = await createSessionToken({
      userId: "user-1",
      workspaceId: "ws-1",
    });
    const verified = await verifySessionToken(token);
    expect(verified).toEqual({ userId: "user-1", workspaceId: "ws-1" });
  });

  it("rejects a token with a tampered signature", async () => {
    const token = await createSessionToken({
      userId: "user-1",
      workspaceId: "ws-1",
    });
    const [body] = token.split(".");
    const tampered = `${body}.not-the-real-signature`;
    await expect(verifySessionToken(tampered)).resolves.toBeNull();
  });

  it("rejects a token with a tampered body (signature no longer matches)", async () => {
    const token = await createSessionToken({
      userId: "user-1",
      workspaceId: "ws-1",
    });
    const [, signature] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({
        userId: "attacker",
        workspaceId: "ws-1",
        exp: 9999999999,
      }),
    ).toString("base64url");
    await expect(
      verifySessionToken(`${forgedBody}.${signature}`),
    ).resolves.toBeNull();
  });

  it("rejects an expired token even with a valid signature", async () => {
    // Signed with the exact same env.SESSION_SECRET session.ts itself uses, so this is
    // genuinely testing expiry enforcement — not accidentally failing on signature mismatch.
    const expiredPayload = { userId: "user-1", workspaceId: "ws-1", exp: 0 };
    const body = Buffer.from(JSON.stringify(expiredPayload)).toString(
      "base64url",
    );
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body),
    );
    const sigB64 = Buffer.from(signature).toString("base64url");
    const token = `${body}.${sigB64}`;
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it("rejects malformed input", async () => {
    await expect(verifySessionToken(undefined)).resolves.toBeNull();
    await expect(verifySessionToken("")).resolves.toBeNull();
    await expect(verifySessionToken("not-a-valid-token")).resolves.toBeNull();
    await expect(verifySessionToken("only-one-part")).resolves.toBeNull();
  });
});
