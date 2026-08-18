import { getCurrentSession } from "@/lib/auth/current-session";
import { getCurrentMembership } from "@/lib/auth/current-membership";
import { dbConnect } from "@/lib/db/connect";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { Workspace } from "@/lib/db/models/workspace";
import {
  listSharesAvailableToMe,
  listSharesGrantedByMe,
} from "@/lib/services/sharing";
import { roleHasCapability } from "@/lib/auth/rbac";
import { SharingClient } from "@/components/sharing/sharing-client";

/**
 * Cross-Workspace Document Sharing management page (`PLAN.md` Phase 11 step 2). Granting is
 * gated on `sharing.manage`; the "shared with me" list below it is visible to any workspace
 * member, since reading what's already been shared is the entire point of the feature.
 */
export default async function SharingPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const membership = await getCurrentMembership(session);
  if (!membership) return null;

  await dbConnect();
  const vendorRepo = new VendorRepository({
    workspaceId: membership.workspaceId,
  });
  const [vendors, otherWorkspaces, grantedByMe, availableToMe] =
    await Promise.all([
      vendorRepo.find().lean(),
      Workspace.find({
        _id: { $ne: membership.workspaceId },
        status: "active",
      }).lean(),
      roleHasCapability(membership.role, "sharing.manage")
        ? listSharesGrantedByMe({ workspaceId: membership.workspaceId })
        : Promise.resolve([]),
      listSharesAvailableToMe({ workspaceId: membership.workspaceId }),
    ]);

  return (
    <SharingClient
      canManage={roleHasCapability(membership.role, "sharing.manage")}
      vendors={vendors.map((v) => ({
        id: v._id.toString(),
        legal_name: v.legal_name,
        domain: v.domain,
        documents: v.documents.map((d) => ({
          id: d._id?.toString() ?? "",
          filename: d.filename,
        })),
      }))}
      otherWorkspaces={otherWorkspaces.map((w) => ({
        id: w._id.toString(),
        entity_name: w.entity_name,
      }))}
      initialGranted={grantedByMe}
      initialAvailable={availableToMe}
    />
  );
}
