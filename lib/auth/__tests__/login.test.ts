// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import argon2 from "argon2";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import { login } from "@/lib/auth/login";
import { env } from "@/lib/env";

/**
 * Integration test against the real (test) database — login() queries User directly, so
 * this is the honest way to verify it, not a mock of Mongoose.
 */
describe("login (integration)", () => {
  const workspaceId = new Types.ObjectId();
  const PLAINTEXT_PASSWORD = "a-real-test-password-42";

  beforeAll(async () => {
    await dbConnect();
    await Workspace.create({
      _id: workspaceId,
      entity_name: "Login Test Workspace",
      slug: `login-test-${workspaceId.toString()}`,
      settings: {
        weights_version: 1,
        tier_thresholds: { tier1_min: 70, tier2_min: 40 },
        enterprise_risk_categories: [],
      },
      status: "active",
    });

    const passwordHash = await argon2.hash(PLAINTEXT_PASSWORD);
    await User.create({
      email: env.SUPER_ADMIN_EMAIL,
      name: "Test Super Admin",
      password_hash: passwordHash,
      memberships: [{ workspace_id: workspaceId, role: "admin" }],
      status: "active",
    });

    await User.create({
      email: "disabled-admin@mv-vra.local",
      name: "Disabled Admin",
      password_hash: passwordHash,
      memberships: [{ workspace_id: workspaceId, role: "admin" }],
      status: "disabled",
    });

    await User.create({
      email: "second-analyst@mv-vra.local",
      name: "Second Analyst",
      password_hash: passwordHash,
      memberships: [{ workspace_id: workspaceId, role: "risk_analyst" }],
      status: "active",
    });

    await User.create({
      email: "no-membership@mv-vra.local",
      name: "No Membership",
      password_hash: passwordHash,
      memberships: [],
      status: "active",
    });
  });

  afterAll(async () => {
    await User.deleteMany({
      email: {
        $in: [
          env.SUPER_ADMIN_EMAIL,
          "disabled-admin@mv-vra.local",
          "second-analyst@mv-vra.local",
          "no-membership@mv-vra.local",
        ],
      },
    });
    await Workspace.deleteOne({ _id: workspaceId });
    await mongoose.disconnect();
  });

  it("succeeds with the correct super-admin email and password", async () => {
    const result = await login(env.SUPER_ADMIN_EMAIL, PLAINTEXT_PASSWORD);
    expect(result).toEqual({
      userId: expect.any(String),
      workspaceId: workspaceId.toString(),
    });
  });

  it("fails with the correct email but wrong password", async () => {
    const result = await login(env.SUPER_ADMIN_EMAIL, "wrong-password");
    expect(result).toBeNull();
  });

  it(
    "succeeds for any active User, not only the configured super admin (Phase 11 —" +
      " DECISIONS.md 024, the single-email gate is gone)",
    async () => {
      const result = await login(
        "second-analyst@mv-vra.local",
        PLAINTEXT_PASSWORD,
      );
      expect(result).toEqual({
        userId: expect.any(String),
        workspaceId: workspaceId.toString(),
      });
    },
  );

  it("fails for a disabled account even with the right password", async () => {
    const result = await login(
      "disabled-admin@mv-vra.local",
      PLAINTEXT_PASSWORD,
    );
    expect(result).toBeNull();
  });

  it("fails for an active account with zero workspace memberships", async () => {
    const result = await login(
      "no-membership@mv-vra.local",
      PLAINTEXT_PASSWORD,
    );
    expect(result).toBeNull();
  });

  it("fails for an email that matches no User document at all", async () => {
    const result = await login(
      "completely-unknown@nowhere.example",
      "whatever",
    );
    expect(result).toBeNull();
  });

  it("is case-insensitive on email", async () => {
    const result = await login(
      env.SUPER_ADMIN_EMAIL.toUpperCase(),
      PLAINTEXT_PASSWORD,
    );
    expect(result).not.toBeNull();
  });
});
