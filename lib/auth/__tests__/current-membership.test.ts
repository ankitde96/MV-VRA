// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import { getCurrentMembership } from "@/lib/auth/current-membership";

/**
 * Phase 11 (`DECISIONS.md` 024): proves the "never trust a cached role" property the
 * module's own docstring claims — a membership removed from `User.memberships` after the
 * session was issued is invisible on the very next call, with no re-login required, because
 * this always re-queries the database rather than reading anything out of the session
 * payload itself.
 */
describe("getCurrentMembership (integration)", () => {
  const workspaceId = new Types.ObjectId();
  const memberUserId = new Types.ObjectId();
  const disabledUserId = new Types.ObjectId();
  const noMembershipUserId = new Types.ObjectId();

  beforeAll(async () => {
    await dbConnect();
    await Workspace.create({
      _id: workspaceId,
      entity_name: "Current Membership Test Workspace",
      slug: `current-membership-test-${workspaceId.toString()}`,
      settings: {
        weights_version: 1,
        tier_thresholds: { tier1_min: 70, tier2_min: 40 },
        enterprise_risk_categories: [],
      },
      status: "active",
    });

    await User.create({
      _id: memberUserId,
      email: "member@current-membership-test.example",
      name: "Member",
      password_hash: "not-a-real-hash",
      memberships: [{ workspace_id: workspaceId, role: "risk_analyst" }],
      status: "active",
    });

    await User.create({
      _id: disabledUserId,
      email: "disabled@current-membership-test.example",
      name: "Disabled",
      password_hash: "not-a-real-hash",
      memberships: [{ workspace_id: workspaceId, role: "admin" }],
      status: "disabled",
    });

    await User.create({
      _id: noMembershipUserId,
      email: "no-membership@current-membership-test.example",
      name: "No Membership",
      password_hash: "not-a-real-hash",
      memberships: [],
      status: "active",
    });
  });

  afterAll(async () => {
    await User.deleteMany({
      _id: { $in: [memberUserId, disabledUserId, noMembershipUserId] },
    });
    await Workspace.deleteOne({ _id: workspaceId });
    await mongoose.disconnect();
  });

  it("resolves the role for an active user with a membership in the session workspace", async () => {
    const membership = await getCurrentMembership({
      userId: memberUserId.toString(),
      workspaceId: workspaceId.toString(),
    });
    expect(membership).toEqual({
      userId: memberUserId.toString(),
      workspaceId: workspaceId.toString(),
      role: "risk_analyst",
    });
  });

  it("returns null for a disabled user even with a valid membership", async () => {
    const membership = await getCurrentMembership({
      userId: disabledUserId.toString(),
      workspaceId: workspaceId.toString(),
    });
    expect(membership).toBeNull();
  });

  it("returns null for an active user with no membership in the session workspace", async () => {
    const membership = await getCurrentMembership({
      userId: noMembershipUserId.toString(),
      workspaceId: workspaceId.toString(),
    });
    expect(membership).toBeNull();
  });

  it("returns null for a session workspace the user is no longer a member of (revocation is immediate)", async () => {
    // Simulates an admin removing the membership after the session cookie was already
    // issued — the next call must see the revocation without a re-login.
    await User.updateOne({ _id: memberUserId }, { $set: { memberships: [] } });
    const membership = await getCurrentMembership({
      userId: memberUserId.toString(),
      workspaceId: workspaceId.toString(),
    });
    expect(membership).toBeNull();

    // Restore for good measure in case test order changes.
    await User.updateOne(
      { _id: memberUserId },
      {
        $set: {
          memberships: [{ workspace_id: workspaceId, role: "risk_analyst" }],
        },
      },
    );
  });
});
