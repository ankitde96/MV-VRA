import argon2 from "argon2";
import { dbConnect } from "@/lib/db/connect";
import { User } from "@/lib/db/models/user";
import type { SessionPayload } from "@/lib/auth/session";

/**
 * Phase 11 (`DECISIONS.md` 024): the single-email gate from Phase 2 is gone. Any active
 * `User` document with a matching password can now log in — `SUPER_ADMIN_EMAIL`/
 * `SUPER_ADMIN_PASSWORD_HASH` remain only as the bootstrap account `scripts/seed.ts`
 * guarantees always exists, not the only account that can authenticate. Real user creation
 * (Phase 11) goes through `lib/services/admin-users.ts`, admin-role-gated.
 *
 * A user may hold memberships in several workspaces (`DATA-MODEL.md` §2). Login picks the
 * *first* membership as the initial `workspaceId` — arbitrary but deterministic (array
 * order, unchanged unless a membership is added/removed) — and the session can move to any
 * other membership afterward via `POST /api/auth/switch-workspace`
 * (`lib/services/workspace-switch.ts`). A user with zero memberships cannot log in at all;
 * there is no "no workspace" session state to build every other route to expect.
 *
 * Returns null uniformly for "no such account," "wrong password," "disabled account," and
 * "no memberships" — the caller (the login route) must not be able to distinguish which, to
 * avoid leaking account existence through the response.
 */
export async function login(
  email: string,
  password: string,
): Promise<SessionPayload | null> {
  await dbConnect();
  const user = await User.findOne({
    email: email.trim().toLowerCase(),
    status: "active",
  });
  if (!user) return null;

  const passwordValid = await argon2
    .verify(user.password_hash, password)
    .catch(() => false);
  if (!passwordValid) return null;

  const membership = user.memberships[0];
  if (!membership) return null;

  return {
    userId: user._id.toString(),
    workspaceId: membership.workspace_id.toString(),
  };
}
