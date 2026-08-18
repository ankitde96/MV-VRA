import { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { NotFoundError } from "@/lib/errors";
import {
  VendorRepository,
  type VendorSpocInput,
} from "@/lib/repositories/vendor-repository";
import { recordAuditEvent } from "@/lib/audit/record-event";
import type { TenantContext } from "@/lib/tenant/context";

/**
 * PLAN.md Phase 4, spec §2.1: "Ability to add and manage a Vendor SPOC ... within the
 * vendor details page." The `spoc` subdocument itself already exists on Vendor (Phase 1/3)
 * — this is the first write path for it.
 */
export async function updateVendorSpoc(
  ctx: TenantContext,
  actor: { userId: string },
  vendorId: string,
  spoc: VendorSpocInput,
) {
  await dbConnect();
  const vendorRepo = new VendorRepository(ctx);

  const vendor = await vendorRepo.findById(vendorId);
  if (!vendor) {
    throw new NotFoundError(`Vendor ${vendorId} not found`);
  }

  await vendorRepo.updateSpoc(vendorId, spoc);

  await recordAuditEvent({
    workspace_id: vendor.workspace_id,
    actor: {
      type: "internal",
      id: new Types.ObjectId(actor.userId),
      email: null,
    },
    action: "vendor.spoc_updated",
    entity_type: "vendor",
    entity_id: vendor._id,
    diff: { spoc },
  });

  return { id: vendor._id.toString(), spoc };
}
