import { dbConnect } from "@/lib/db/connect";
import { SharedDocument } from "@/lib/db/models/shared-document";
import { Workspace } from "@/lib/db/models/workspace";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { recordAuditEvent } from "@/lib/audit/record-event";
import { getStorageDriver } from "@/lib/storage";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

export interface SharingActor {
  userId: string;
}

/**
 * Phase 11 (`DECISIONS.md` 024). `SharedDocument` (`lib/db/models/shared-document.ts`) has
 * existed unused since Phase 1 — this is the first code that reads or writes it. Scope is
 * deliberately narrow for this MVP pass: only Vendor-uploaded documents
 * (`Vendor.documents[]`, Phase 4), keyed by `vendor_domain` rather than a specific vendor
 * document id in the *target* workspace — the point of the feature is that Workspace B, which
 * has its own `Vendor` record for the same company domain, can read Workspace A's already-
 * verified documents for that vendor without re-collecting them, `PLAN.md` §2's stated
 * rationale.
 *
 * `document_ref` is deliberately opaque `Mixed` in the schema — this service is the only
 * code that knows its shape (`{ vendor_id, document_id }`), matching the schema's own
 * comment that it's resolved only by whatever reads it.
 */
export interface DocumentRef {
  vendor_id: string;
  document_id: string;
}

export async function shareVendorDocument(
  ctx: TenantContext,
  actor: SharingActor,
  input: {
    vendorId: string;
    documentId: string;
    targetWorkspaceIds: string[];
    expiresAt?: Date | null;
  },
) {
  if (input.targetWorkspaceIds.length === 0) {
    throw new ValidationError("At least one target workspace is required");
  }

  await dbConnect();
  const ownerWorkspaceId = toObjectId(ctx.workspaceId);

  const vendorRepo = new VendorRepository(ctx);
  const vendor = await vendorRepo.findById(input.vendorId).lean();
  if (!vendor) {
    throw new NotFoundError(`Vendor ${input.vendorId} not found`);
  }
  const document = vendor.documents.find(
    (d) => d._id?.toString() === input.documentId,
  );
  if (!document) {
    throw new NotFoundError(
      `Document ${input.documentId} not found on this vendor`,
    );
  }

  const targetIds = [...new Set(input.targetWorkspaceIds)].map((id) =>
    toObjectId(id),
  );
  if (targetIds.some((id) => id.equals(ownerWorkspaceId))) {
    throw new ValidationError(
      "Cannot share a document with your own workspace",
    );
  }
  const targetWorkspaces = await Workspace.find({
    _id: { $in: targetIds },
    status: "active",
  }).lean();
  if (targetWorkspaces.length !== targetIds.length) {
    throw new ValidationError(
      "One or more target workspaces do not exist or are not active",
    );
  }

  const shared = await SharedDocument.findOneAndUpdate(
    {
      owner_workspace_id: ownerWorkspaceId,
      vendor_domain: vendor.domain,
      "document_ref.vendor_id": vendor._id.toString(),
      "document_ref.document_id": document._id?.toString(),
    },
    {
      $addToSet: { shared_with: { $each: targetIds } },
      $set: {
        granted_by: toObjectId(actor.userId),
        granted_at: new Date(),
        expires_at: input.expiresAt ?? null,
      },
      $setOnInsert: {
        document_ref: {
          vendor_id: vendor._id.toString(),
          document_id: document._id?.toString(),
        } as DocumentRef,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  await recordAuditEvent({
    workspace_id: ownerWorkspaceId,
    actor: { type: "internal", id: toObjectId(actor.userId), email: null },
    action: "sharing.granted",
    entity_type: "SharedDocument",
    entity_id: shared!._id,
    diff: {
      vendor_domain: vendor.domain,
      document_id: input.documentId,
      target_workspace_ids: targetIds.map((id) => id.toString()),
    },
  });

  return shared;
}

export async function revokeVendorDocumentShare(
  ctx: TenantContext,
  actor: SharingActor,
  shareId: string,
  targetWorkspaceId: string,
) {
  await dbConnect();
  const ownerWorkspaceId = toObjectId(ctx.workspaceId);

  const shared = await SharedDocument.findOne({
    _id: shareId,
    owner_workspace_id: ownerWorkspaceId,
  });
  if (!shared) {
    throw new NotFoundError("Share not found");
  }

  shared.shared_with = shared.shared_with.filter(
    (id) => id.toString() !== targetWorkspaceId,
  );
  await shared.save();

  await recordAuditEvent({
    workspace_id: ownerWorkspaceId,
    actor: { type: "internal", id: toObjectId(actor.userId), email: null },
    action: "sharing.revoked",
    entity_type: "SharedDocument",
    entity_id: shared._id,
    diff: { target_workspace_id: targetWorkspaceId },
  });

  return {
    share_id: shared._id.toString(),
    shared_with: shared.shared_with.map((id) => id.toString()),
  };
}

/** Everything this workspace has granted out — the "who did I share with" management view. */
export async function listSharesGrantedByMe(ctx: TenantContext) {
  await dbConnect();
  const shares = await SharedDocument.find({
    owner_workspace_id: toObjectId(ctx.workspaceId),
  }).lean();
  const workspaceIds = [
    ...new Set(shares.flatMap((s) => s.shared_with.map((id) => id.toString()))),
  ];
  const workspaces = await Workspace.find({
    _id: { $in: workspaceIds },
  }).lean();
  const nameById = new Map(
    workspaces.map((w) => [w._id.toString(), w.entity_name]),
  );

  return shares.map((s) => ({
    id: s._id.toString(),
    vendor_domain: s.vendor_domain,
    document_ref: s.document_ref as DocumentRef,
    shared_with: s.shared_with.map((id) => ({
      workspace_id: id.toString(),
      workspace_name: nameById.get(id.toString()) ?? "Unknown workspace",
    })),
    granted_at: s.granted_at.toISOString(),
    expires_at: s.expires_at?.toISOString() ?? null,
  }));
}

/**
 * The read-side list — every share another workspace has granted to `ctx.workspaceId`, not
 * expired. This is a deliberate cross-tenant read (`CONSTRAINTS.md` #8's one sanctioned
 * exception) — the query filters on `shared_with`, not `owner_workspace_id`, so it returns
 * rows this workspace does not own.
 */
export async function listSharesAvailableToMe(ctx: TenantContext) {
  await dbConnect();
  const workspaceId = toObjectId(ctx.workspaceId);
  const shares = await SharedDocument.find({
    shared_with: workspaceId,
    $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
  }).lean();

  const ownerIds = [
    ...new Set(shares.map((s) => s.owner_workspace_id.toString())),
  ];
  const owners = await Workspace.find({ _id: { $in: ownerIds } }).lean();
  const nameById = new Map(
    owners.map((w) => [w._id.toString(), w.entity_name]),
  );

  return shares.map((s) => ({
    id: s._id.toString(),
    owner_workspace_id: s.owner_workspace_id.toString(),
    owner_workspace_name:
      nameById.get(s.owner_workspace_id.toString()) ?? "Unknown workspace",
    vendor_domain: s.vendor_domain,
    document_ref: s.document_ref as DocumentRef,
    granted_at: s.granted_at.toISOString(),
    expires_at: s.expires_at?.toISOString() ?? null,
  }));
}

/**
 * The actual cross-tenant file read. Re-verifies `ctx.workspaceId` is in `shared_with` and
 * not expired from the database, not from whatever list the client is looking at — the same
 * "never trust the caller's claim" discipline every other authorization check in this
 * codebase follows. Every call records an audit event unconditionally, per the schema's own
 * comment (`lib/db/models/shared-document.ts`) that this is enforced by the reader, not the
 * schema.
 */
export async function readSharedDocument(
  ctx: TenantContext,
  actor: SharingActor,
  shareId: string,
) {
  await dbConnect();
  const readerWorkspaceId = toObjectId(ctx.workspaceId);

  const shared = await SharedDocument.findById(shareId).lean();
  if (!shared) {
    throw new NotFoundError("Share not found");
  }

  const isGranted = shared.shared_with.some((id) =>
    id.equals(readerWorkspaceId),
  );
  const isExpired = Boolean(
    shared.expires_at && shared.expires_at.getTime() < Date.now(),
  );
  if (!isGranted || isExpired) {
    throw new ForbiddenError("This document is not shared with your workspace");
  }

  const ref = shared.document_ref as DocumentRef;
  // Deliberately scoped to the *owner's* workspace, not the reader's — this is the one place
  // in the codebase a repository is constructed with a workspace_id that isn't the current
  // session's, because the grant above is the authorization, not the session.
  const ownerVendorRepo = new VendorRepository({
    workspaceId: shared.owner_workspace_id,
  });
  const vendor = await ownerVendorRepo.findById(ref.vendor_id).lean();
  const document = vendor?.documents.find(
    (d) => d._id?.toString() === ref.document_id,
  );
  if (!vendor || !document) {
    throw new NotFoundError("The shared document no longer exists");
  }

  const storage = getStorageDriver();
  const body = await storage.get(document.key);

  await recordAuditEvent({
    workspace_id: readerWorkspaceId,
    actor: { type: "internal", id: toObjectId(actor.userId), email: null },
    action: "sharing.document_read",
    entity_type: "SharedDocument",
    entity_id: shared._id,
    diff: {
      owner_workspace_id: shared.owner_workspace_id.toString(),
      vendor_domain: shared.vendor_domain,
      document_id: ref.document_id,
    },
  });

  return { document, body };
}
