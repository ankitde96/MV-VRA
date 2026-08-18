// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import { login } from "@/lib/auth/login";
import { ValidationError } from "@/lib/errors";
import {
  addWorkspaceUser,
  listWorkspaceUsers,
  removeWorkspaceUser,
  updateWorkspaceUserRole,
} from "@/lib/services/admin-users";

/**
 * PLAN.md Phase 11 step 1's admin-only "add user" flow (`DECISIONS.md` 024) — proves the
 * newly-added user can actually log in with the password the admin chose (not just that a
 * document with the right shape was written), and that a second workspace can grant a
 * membership to an *existing* email rather than duplicating the account (`User.email`'s
 * unique index).
 */
describe("admin-users service (integration)", () => {
  const workspaceId = new Types.ObjectId();
  const secondWorkspaceId = new Types.ObjectId();
  const adminUserId = new Types.ObjectId();
  const PLAINTEXT_PASSWORD = "a-real-test-password-99";

  beforeAll(async () => {
    await dbConnect();
    await Workspace.create([
      {
        _id: workspaceId,
        entity_name: "Admin Users Test Workspace",
        slug: `admin-users-test-${workspaceId.toString()}`,
        settings: {
          weights_version: 1,
          tier_thresholds: { tier1_min: 70, tier2_min: 40 },
          enterprise_risk_categories: [],
        },
        status: "active",
      },
      {
        _id: secondWorkspaceId,
        entity_name: "Admin Users Test Workspace 2",
        slug: `admin-users-test-2-${secondWorkspaceId.toString()}`,
        settings: {
          weights_version: 1,
          tier_thresholds: { tier1_min: 70, tier2_min: 40 },
          enterprise_risk_categories: [],
        },
        status: "active",
      },
    ]);

    await User.create({
      _id: adminUserId,
      email: "admin@admin-users-test.example",
      name: "Admin",
      password_hash: "not-a-real-hash",
      memberships: [{ workspace_id: workspaceId, role: "admin" }],
      status: "active",
    });
  });

  afterAll(async () => {
    await User.deleteMany({
      email: {
        $in: [
          "admin@admin-users-test.example",
          "new-analyst@admin-users-test.example",
          "existing@admin-users-test.example",
        ],
      },
    });
    await Workspace.deleteMany({
      _id: { $in: [workspaceId, secondWorkspaceId] },
    });
    await mongoose.disconnect();
  });

  it("creates a brand-new user who can then log in with the chosen password", async () => {
    const result = await addWorkspaceUser(
      { workspaceId },
      { userId: adminUserId.toString() },
      {
        email: "new-analyst@admin-users-test.example",
        name: "New Analyst",
        role: "risk_analyst",
        password: PLAINTEXT_PASSWORD,
      },
    );
    expect(result.created).toBe(true);

    const loginResult = await login(
      "new-analyst@admin-users-test.example",
      PLAINTEXT_PASSWORD,
    );
    expect(loginResult).toEqual({
      userId: result.user_id,
      workspaceId: workspaceId.toString(),
    });
  });

  it("grants an existing user (from a sibling workspace) a new membership instead of duplicating them", async () => {
    await User.create({
      email: "existing@admin-users-test.example",
      name: "Existing Elsewhere",
      password_hash: "not-a-real-hash",
      memberships: [{ workspace_id: secondWorkspaceId, role: "viewer" }],
      status: "active",
    });

    const result = await addWorkspaceUser(
      { workspaceId },
      { userId: adminUserId.toString() },
      {
        email: "existing@admin-users-test.example",
        name: "ignored on an existing account",
        role: "business_owner",
        password: "irrelevant-not-used-for-existing-accounts",
      },
    );
    expect(result.created).toBe(false);

    const users = await listWorkspaceUsers({ workspaceId });
    const added = users.find(
      (u) => u.email === "existing@admin-users-test.example",
    );
    expect(added?.role).toBe("business_owner");

    // Still only one User document — this workspace's membership was appended, not a
    // duplicate account created.
    const count = await User.countDocuments({
      email: "existing@admin-users-test.example",
    });
    expect(count).toBe(1);
  });

  it("refuses to grant a membership the user already has in this workspace", async () => {
    await expect(
      addWorkspaceUser(
        { workspaceId },
        { userId: adminUserId.toString() },
        {
          email: "existing@admin-users-test.example",
          name: "Existing Elsewhere",
          role: "viewer",
          password: "irrelevant-not-used-for-existing-accounts",
        },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("updates a role scoped to this workspace only, leaving other workspace memberships untouched", async () => {
    await updateWorkspaceUserRole(
      { workspaceId },
      { userId: adminUserId.toString() },
      (await User.findOne({
        email: "existing@admin-users-test.example",
      }))!._id.toString(),
      "admin",
    );

    const users = await listWorkspaceUsers({ workspaceId });
    const updated = users.find(
      (u) => u.email === "existing@admin-users-test.example",
    );
    expect(updated?.role).toBe("admin");

    const fullUser = await User.findOne({
      email: "existing@admin-users-test.example",
    }).lean();
    const otherMembership = fullUser?.memberships.find(
      (m) => m.workspace_id.toString() === secondWorkspaceId.toString(),
    );
    expect(otherMembership?.role).toBe("viewer");
  });

  it("removes only this workspace membership, not the account or its other memberships", async () => {
    const target = (await User.findOne({
      email: "existing@admin-users-test.example",
    }))!;

    await removeWorkspaceUser(
      { workspaceId },
      { userId: adminUserId.toString() },
      target._id.toString(),
    );

    const users = await listWorkspaceUsers({ workspaceId });
    expect(
      users.some((u) => u.email === "existing@admin-users-test.example"),
    ).toBe(false);

    const fullUser = await User.findById(target._id).lean();
    expect(fullUser?.memberships).toHaveLength(1);
    expect(fullUser?.memberships[0]?.workspace_id.toString()).toBe(
      secondWorkspaceId.toString(),
    );
  });

  it("refuses to let an admin remove their own membership", async () => {
    await expect(
      removeWorkspaceUser(
        { workspaceId },
        { userId: adminUserId.toString() },
        adminUserId.toString(),
      ),
    ).rejects.toThrow(ValidationError);
  });
});
