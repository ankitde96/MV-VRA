import { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  VendorRepository,
  type VendorSpocFields,
} from "@/lib/repositories/vendor-repository";
import { recordAuditEvent } from "@/lib/audit/record-event";
import type { TenantContext } from "@/lib/tenant/context";

/**
 * ASSESSMENT-WORKFLOW-PLAN.md Stage 2 (D2, DECISIONS.md 040/042) — replaces the single-SPOC
 * `updateVendorSpoc()` this file used to export. Every write here targets `Vendor.spocs[]`;
 * the legacy `Vendor.spoc` object is never touched by this module again.
 */

interface SpocActor {
  userId: string;
}

async function loadVendorWithSpoc(
  ctx: TenantContext,
  vendorId: string,
  spocId: string,
) {
  const vendorRepo = new VendorRepository(ctx);
  const vendor = await vendorRepo.findById(vendorId);
  if (!vendor) {
    throw new NotFoundError(`Vendor ${vendorId} not found`);
  }
  const spoc = vendor.spocs.find((s) => s._id?.toString() === spocId);
  if (!spoc) {
    throw new NotFoundError(`SPOC ${spocId} not found on vendor ${vendorId}`);
  }
  return { vendorRepo, vendor, spoc };
}

export async function addVendorSpoc(
  ctx: TenantContext,
  actor: SpocActor,
  vendorId: string,
  fields: VendorSpocFields,
) {
  await dbConnect();
  const vendorRepo = new VendorRepository(ctx);
  const vendor = await vendorRepo.findById(vendorId);
  if (!vendor) {
    throw new NotFoundError(`Vendor ${vendorId} not found`);
  }

  const spocId = new Types.ObjectId();
  // The first SPOC a vendor ever gets is its primary by construction — there is no
  // separate "who is primary" question to ask when the list starts empty.
  const isPrimary = vendor.spocs.length === 0;

  await vendorRepo.addSpoc(vendorId, {
    _id: spocId,
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
    is_primary: isPrimary,
    status: "active",
  });

  await recordAuditEvent({
    workspace_id: vendor.workspace_id,
    actor: {
      type: "internal",
      id: new Types.ObjectId(actor.userId),
      email: null,
    },
    action: "vendor.spoc_added",
    entity_type: "vendor",
    entity_id: vendor._id,
    diff: { spoc_id: spocId.toString(), ...fields, is_primary: isPrimary },
  });

  return {
    id: spocId.toString(),
    ...fields,
    is_primary: isPrimary,
    status: "active" as const,
  };
}

export async function updateVendorSpocFields(
  ctx: TenantContext,
  actor: SpocActor,
  vendorId: string,
  spocId: string,
  fields: Partial<VendorSpocFields>,
) {
  await dbConnect();
  if (Object.keys(fields).length === 0) {
    throw new ValidationError("No updatable fields provided");
  }
  const { vendorRepo, vendor } = await loadVendorWithSpoc(
    ctx,
    vendorId,
    spocId,
  );

  await vendorRepo.updateSpocFields(vendorId, spocId, fields);

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
    diff: { spoc_id: spocId, ...fields },
  });

  return { ok: true as const };
}

/**
 * A vendor must always keep at least one active SPOC (ASSESSMENT-WORKFLOW-PLAN.md Stage 2)
 * — OTP login has nothing to resolve against otherwise. Deactivating the primary is
 * refused outright rather than silently picking a new one; the admin must choose.
 */
export async function setVendorSpocStatus(
  ctx: TenantContext,
  actor: SpocActor,
  vendorId: string,
  spocId: string,
  status: "active" | "inactive",
) {
  await dbConnect();
  const { vendorRepo, vendor, spoc } = await loadVendorWithSpoc(
    ctx,
    vendorId,
    spocId,
  );

  if (status === "inactive") {
    if (spoc.is_primary) {
      throw new ValidationError(
        "Cannot deactivate the primary SPOC — set a different SPOC as primary first.",
      );
    }
    const activeCount = vendor.spocs.filter(
      (s) => s.status === "active",
    ).length;
    if (activeCount <= 1) {
      throw new ValidationError("A vendor must keep at least one active SPOC.");
    }
  }

  await vendorRepo.setSpocStatus(vendorId, spocId, status);

  await recordAuditEvent({
    workspace_id: vendor.workspace_id,
    actor: {
      type: "internal",
      id: new Types.ObjectId(actor.userId),
      email: null,
    },
    action: "vendor.spoc_status_changed",
    entity_type: "vendor",
    entity_id: vendor._id,
    diff: { spoc_id: spocId, status },
  });

  return { ok: true as const };
}

export async function setPrimaryVendorSpoc(
  ctx: TenantContext,
  actor: SpocActor,
  vendorId: string,
  spocId: string,
) {
  await dbConnect();
  const { vendorRepo, vendor, spoc } = await loadVendorWithSpoc(
    ctx,
    vendorId,
    spocId,
  );

  if (spoc.status !== "active") {
    throw new ValidationError("Only an active SPOC can be made primary.");
  }

  await vendorRepo.setPrimarySpoc(vendorId, spocId);

  await recordAuditEvent({
    workspace_id: vendor.workspace_id,
    actor: {
      type: "internal",
      id: new Types.ObjectId(actor.userId),
      email: null,
    },
    action: "vendor.spoc_primary_changed",
    entity_type: "vendor",
    entity_id: vendor._id,
    diff: { spoc_id: spocId },
  });

  return { ok: true as const };
}
