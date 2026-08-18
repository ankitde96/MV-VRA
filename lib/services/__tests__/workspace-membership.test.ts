// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import { ForbiddenError } from "@/lib/errors";
import {
  listMembershipsForUser,
  switchWorkspace,
} from "@/lib/services/workspace-membership";

/**
 * `PLAN.md` Phase 11 step 1's workspace switcher — `switchWorkspace` re-derives membership
 * from the database rather than trusting the caller's claim (`CONSTRAINTS.md` #8 extended to
 * the session itself), which is the property under test here alongside the happy path.
 */
describe("workspace-membership service (integration)", () => {
  const memberWorkspaceId = new Types.ObjectId();
  const otherWorkspaceId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const disabledUserId = new Types.ObjectId();

  beforeAll(async () => {
    await dbConnect();
    await Workspace.create([
      {
        _id: memberWorkspaceId,
        entity_name: "Membership Test Workspace",
        slug: `membership-test-${memberWorkspaceId.toString()}`,
        settings: {
          weights_version: 1,
          tier_thresholds: { tier1_min: 70, tier2_min: 40 },
          enterprise_risk_categories: [],
        },
        status: "active",
      },
      {
        _id: otherWorkspaceId,
        entity_name: "Not A Member Workspace",
        slug: `membership-test-other-${otherWorkspaceId.toString()}`,
        settings: {
          weights_version: 1,
          tier_thresholds: { tier1_min: 70, tier2_min: 40 },
          enterprise_risk_categories: [],
        },
        status: "active",
      },
    ]);

    await User.create([
      {
        _id: userId,
        email: "membership-user@membership-test.example",
        name: "Membership User",
        password_hash: "not-a-real-hash",
        memberships: [
          { workspace_id: memberWorkspaceId, role: "risk_analyst" },
        ],
        status: "active",
      },
      {
        _id: disabledUserId,
        email: "disabled-membership-user@membership-test.example",
        name: "Disabled User",
        password_hash: "not-a-real-hash",
        memberships: [{ workspace_id: memberWorkspaceId, role: "admin" }],
        status: "disabled",
      },
    ]);
  });

  afterAll(async () => {
    await User.deleteMany({ _id: { $in: [userId, disabledUserId] } });
    await Workspace.deleteMany({
      _id: { $in: [memberWorkspaceId, otherWorkspaceId] },
    });
    await mongoose.disconnect();
  });

  it("lists only the workspaces the user has a membership in", async () => {
    const memberships = await listMembershipsForUser(userId.toString());
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toEqual({
      workspace_id: memberWorkspaceId.toString(),
      workspace_name: "Membership Test Workspace",
      role: "risk_analyst",
    });
  });

  it("returns an empty list for a disabled user", async () => {
    const memberships = await listMembershipsForUser(disabledUserId.toString());
    expect(memberships).toEqual([]);
  });

  it("switches the session to a workspace the user is a member of", async () => {
    const next = await switchWorkspace(
      { userId: userId.toString(), workspaceId: otherWorkspaceId.toString() },
      memberWorkspaceId.toString(),
    );
    expect(next).toEqual({
      userId: userId.toString(),
      workspaceId: memberWorkspaceId.toString(),
    });
  });

  it("refuses to switch to a workspace the user has no membership in, even if claimed", async () => {
    await expect(
      switchWorkspace(
        {
          userId: userId.toString(),
          workspaceId: memberWorkspaceId.toString(),
        },
        otherWorkspaceId.toString(),
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses to switch for a disabled user even with a valid target membership", async () => {
    await expect(
      switchWorkspace(
        {
          userId: disabledUserId.toString(),
          workspaceId: memberWorkspaceId.toString(),
        },
        memberWorkspaceId.toString(),
      ),
    ).rejects.toThrow(ForbiddenError);
  });
});
