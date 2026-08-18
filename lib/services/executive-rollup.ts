import { dbConnect } from "@/lib/db/connect";
import { User } from "@/lib/db/models/user";
import { Workspace } from "@/lib/db/models/workspace";
import { Vendor } from "@/lib/db/models/vendor";
import { Risk } from "@/lib/db/models/risk";
import { roleHasCapability, type Role } from "@/lib/auth/rbac";

export interface WorkspaceRollup {
  workspace_id: string;
  workspace_name: string;
  role: Role;
  vendors_by_tier: {
    tier1: number;
    tier2: number;
    tier3: number;
    unscored: number;
  };
  open_risks_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  overdue_cap_tasks: number;
}

export interface ExecutiveRollupResult {
  workspaces: WorkspaceRollup[];
  total_membership_count: number;
  authorized_workspace_count: number;
}

/**
 * `FLOW.md` F6's named gap: "Authorization must be enforced per workspace, not once at the
 * top." This function is the literal implementation of that sentence — it does not take a
 * single `TenantContext` and does not check "is this user allowed to see the roll-up" as one
 * yes/no gate before the loop. It walks every membership the user holds and decides,
 * *inside* the loop, whether `rollup.view` applies to *that specific workspace's role* —
 * a `viewer` membership in workspace A and an `admin` membership in workspace B (both
 * entirely possible for the same `User`, `DATA-MODEL.md` §2) must produce a roll-up that
 * includes B and silently skips A, not one that includes or excludes both based on whichever
 * role the caller happened to be using in their current session.
 *
 * Deliberately does not take a `TenantContext` at all — this is the one function in the
 * codebase for which a single workspace scope would be the wrong signature, not a stricter
 * one.
 */
export async function getExecutiveRollup(
  userId: string,
): Promise<ExecutiveRollupResult> {
  await dbConnect();

  const user = await User.findOne({ _id: userId, status: "active" }).lean();
  if (!user) {
    return {
      workspaces: [],
      total_membership_count: 0,
      authorized_workspace_count: 0,
    };
  }

  const authorizedMemberships = user.memberships.filter((m) =>
    roleHasCapability(m.role as Role, "rollup.view"),
  );

  const workspaceDocs = await Workspace.find({
    _id: { $in: authorizedMemberships.map((m) => m.workspace_id) },
  }).lean();
  const nameById = new Map(
    workspaceDocs.map((w) => [w._id.toString(), w.entity_name]),
  );

  const workspaces: WorkspaceRollup[] = [];
  for (const membership of authorizedMemberships) {
    const workspaceId = membership.workspace_id;

    const [tierCounts, severityCounts, overdueCapCount] = await Promise.all([
      Vendor.aggregate([
        { $match: { workspace_id: workspaceId } },
        { $group: { _id: "$inherent_risk_tier", count: { $sum: 1 } } },
      ]),
      Risk.aggregate([
        { $match: { workspace_id: workspaceId, status: { $ne: "closed" } } },
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),
      Risk.countDocuments({
        workspace_id: workspaceId,
        "cap_tasks.status": "overdue",
      }),
    ]);

    const vendorsByTier = { tier1: 0, tier2: 0, tier3: 0, unscored: 0 };
    for (const row of tierCounts as { _id: number | null; count: number }[]) {
      if (row._id === 1) vendorsByTier.tier1 = row.count;
      else if (row._id === 2) vendorsByTier.tier2 = row.count;
      else if (row._id === 3) vendorsByTier.tier3 = row.count;
      else vendorsByTier.unscored += row.count;
    }

    const openRisksBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const row of severityCounts as { _id: string; count: number }[]) {
      if (row._id in openRisksBySeverity) {
        openRisksBySeverity[row._id as keyof typeof openRisksBySeverity] =
          row.count;
      }
    }

    workspaces.push({
      workspace_id: workspaceId.toString(),
      workspace_name:
        nameById.get(workspaceId.toString()) ?? "Unknown workspace",
      role: membership.role as Role,
      vendors_by_tier: vendorsByTier,
      open_risks_by_severity: openRisksBySeverity,
      overdue_cap_tasks: overdueCapCount,
    });
  }

  return {
    workspaces,
    total_membership_count: user.memberships.length,
    authorized_workspace_count: authorizedMemberships.length,
  };
}
