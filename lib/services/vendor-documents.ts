import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { NotFoundError } from "@/lib/errors";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { recordAuditEvent } from "@/lib/audit/record-event";
import { getStorageDriver } from "@/lib/storage";
import {
  sanitizeFilename,
  validateUploadedFile,
} from "@/lib/uploads/constraints";
import type { TenantContext } from "@/lib/tenant/context";

export interface UploadVendorDocumentInput {
  filename: string;
  mime: string;
  body: Buffer;
}

export async function uploadVendorDocument(
  ctx: TenantContext,
  actor: { userId: string },
  vendorId: string,
  input: UploadVendorDocumentInput,
) {
  validateUploadedFile({ mime: input.mime, size: input.body.byteLength });

  await dbConnect();
  const vendorRepo = new VendorRepository(ctx);
  const vendor = await vendorRepo.findById(vendorId);
  if (!vendor) {
    throw new NotFoundError(`Vendor ${vendorId} not found`);
  }

  // Namespacing by workspace/vendor is defense in depth, not the authorization boundary —
  // that boundary is `getVendorDocument`'s re-check against this vendor's own `documents`
  // array below. A leaked key alone is still not enough to retrieve a file
  // (CONSTRAINTS.md #10).
  const key = `${vendor.workspace_id.toString()}/${vendor._id.toString()}/${randomUUID()}-${sanitizeFilename(input.filename)}`;

  const storage = getStorageDriver();
  const stored = await storage.put(key, input.body);

  const document = {
    _id: new Types.ObjectId(),
    key,
    filename: input.filename,
    mime: input.mime,
    size: stored.size,
    uploaded_by: new Types.ObjectId(actor.userId),
    uploaded_at: new Date(),
  };
  await vendorRepo.addDocument(vendorId, document);

  await recordAuditEvent({
    workspace_id: vendor.workspace_id,
    actor: {
      type: "internal",
      id: new Types.ObjectId(actor.userId),
      email: null,
    },
    action: "vendor.document_uploaded",
    entity_type: "vendor",
    entity_id: vendor._id,
    diff: { filename: input.filename, mime: input.mime, size: stored.size },
  });

  return document;
}

export async function getVendorDocument(
  ctx: TenantContext,
  vendorId: string,
  documentId: string,
) {
  await dbConnect();
  const vendorRepo = new VendorRepository(ctx);
  const vendor = await vendorRepo.findById(vendorId);
  if (!vendor) {
    throw new NotFoundError(`Vendor ${vendorId} not found`);
  }

  // The authorization check: `findById` already scoped `vendor` to this session's
  // workspace_id (TenantRepository.scope()), and the requested document must belong to
  // *this* vendor's own subdocument array — a valid-looking id for another vendor's
  // document, or a raw storage key, is never enough on its own
  // (lib/services/__tests__/vendor-documents.test.ts covers both).
  const document = vendor.documents.find(
    (doc) => doc._id?.toString() === documentId,
  );
  if (!document) {
    throw new NotFoundError(`Document ${documentId} not found`);
  }

  const storage = getStorageDriver();
  const body = await storage.get(document.key);
  return { document, body };
}
