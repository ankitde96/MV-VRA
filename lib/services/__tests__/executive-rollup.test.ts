// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import { Vendor } from "@/lib/db/models/vendor";
import { Risk } from "@/lib/db/models/risk";
import { getExecutiveRollup } from "@/lib/services/executive-rollup";

/**
 * `FLOW.md` F6's per-membership authorization requirement — the same `User` holds an
 * `admin` membership in one workspace and a `viewer` membership in another, and the
 * roll-up must include the former's numbers while silently omitting the latter's, never a
 * single yes/no gate applied to the whole request.
 */
describe("executive-rollup service (integration)", () => {
  const workspaceAdmin = new Types.ObjectId();
  const workspaceViewerOnly = new Types.ObjectId();
  const userId = new Types.ObjectId();

  beforeAll(async () => {
    await dbConnect();
    await Workspace.create([
      {
        _id: workspaceAdmin,
        entity_name: "Rollup Admin Workspace",
        slug: `rollup-admin-${workspaceAdmin.toString()}`,
        settings: {
          weights_version: 1,
          tier_thresholds: { tier1_min: 70, tier2_min: 40 },
          enterprise_risk_categories: [],
        },
        status: "active",
      },
      {
        _id: workspaceViewerOnly,
        entity_name: "Rollup Viewer-Only Workspace",
        slug: `rollup-viewer-${workspaceViewerOnly.toString()}`,
        settings: {
          weights_version: 1,
          tier_thresholds: { tier1_min: 70, tier2_min: 40 },
          enterprise_risk_categories: [],
        },
        status: "active",
      },
    ]);

    await User.create({
      _id: userId,
      email: "rollup-user@rollup-test.example",
      name: "Rollup User",
      password_hash: "not-a-real-hash",
      memberships: [
        { workspace_id: workspaceAdmin, role: "admin" },
        { workspace_id: workspaceViewerOnly, role: "viewer" },
      ],
      status: "active",
    });

    await Vendor.create([
      {
        workspace_id: workspaceAdmin,
        legal_name: "Tier 1 Vendor",
        domain: `rollup-tier1-${workspaceAdmin.toString()}.example`,
        spoc: {
          spoc_name: "S",
          spoc_email: "s@rollup-test.example",
          spoc_phone: "+1",
        },
        inherent_risk_tier: 1,
      },
      {
        workspace_id: workspaceAdmin,
        legal_name: "Tier 2 Vendor",
        domain: `rollup-tier2-${workspaceAdmin.toString()}.example`,
        spoc: {
          spoc_name: "S",
          spoc_email: "s2@rollup-test.example",
          spoc_phone: "+1",
        },
        inherent_risk_tier: 2,
      },
      {
        workspace_id: workspaceViewerOnly,
        legal_name: "Should Never Be Counted",
        domain: `rollup-excluded-${workspaceViewerOnly.toString()}.example`,
        spoc: {
          spoc_name: "S",
          spoc_email: "s3@rollup-test.example",
          spoc_phone: "+1",
        },
        inherent_risk_tier: 1,
      },
    ]);

    await Risk.create({
      workspace_id: workspaceAdmin,
      assessment_id: new Types.ObjectId(),
      engagement_id: new Types.ObjectId(),
      vendor_id: new Types.ObjectId(),
      control_id: "fixture-control",
      title: "Open critical risk",
      description: "fixture",
      severity: "critical",
      enterprise_risk_category: "Operational",
      impact_level: "high",
      residual_score: 80,
      status: "open",
    });
  });

  afterAll(async () => {
    await User.deleteOne({ _id: userId });
    await Vendor.deleteMany({
      workspace_id: { $in: [workspaceAdmin, workspaceViewerOnly] },
    });
    await Risk.deleteMany({
      workspace_id: { $in: [workspaceAdmin, workspaceViewerOnly] },
    });
    await Workspace.deleteMany({
      _id: { $in: [workspaceAdmin, workspaceViewerOnly] },
    });
    await mongoose.disconnect();
  });

  it("includes the admin-role workspace and excludes the viewer-role workspace", async () => {
    const result = await getExecutiveRollup(userId.toString());

    expect(result.total_membership_count).toBe(2);
    expect(result.authorized_workspace_count).toBe(1);
    expect(result.workspaces).toHaveLength(1);

    const included = result.workspaces[0]!;
    expect(included.workspace_id).toBe(workspaceAdmin.toString());
    expect(included.role).toBe("admin");
    expect(included.vendors_by_tier).toEqual({
      tier1: 1,
      tier2: 1,
      tier3: 0,
      unscored: 0,
    });
    expect(included.open_risks_by_severity.critical).toBe(1);

    expect(
      result.workspaces.some(
        (w) => w.workspace_id === workspaceViewerOnly.toString(),
      ),
    ).toBe(false);
  });

  it("returns an empty result for a disabled user", async () => {
    await User.updateOne({ _id: userId }, { status: "disabled" });
    const result = await getExecutiveRollup(userId.toString());
    expect(result).toEqual({
      workspaces: [],
      total_membership_count: 0,
      authorized_workspace_count: 0,
    });
    await User.updateOne({ _id: userId }, { status: "active" });
  });
});
