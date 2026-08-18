import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  OffboardingRepository,
  type CertificateKind,
} from "@/lib/repositories/offboarding-repository";
import { EngagementRepository } from "@/lib/repositories/engagement-repository";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { AssessmentRepository } from "@/lib/repositories/assessment-repository";
import { User } from "@/lib/db/models/user";
import { recordAuditEvent } from "@/lib/audit/record-event";
import { getStorageDriver } from "@/lib/storage";
import {
  sanitizeFilename,
  validateUploadedFile,
} from "@/lib/uploads/constraints";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

export interface OffboardingActor {
  userId: string;
}

export interface ChecklistItemSeed {
  label: string;
  owner_id: string;
}

export type ChecklistItemStatus = "pending" | "in_progress" | "done";

/**
 * `Engagement.status` values `PLAN.md` Phase 10 offboarding may start from — anything not
 * already mid-offboarding or terminal. Deliberately permissive (any pre-offboarding status
 * can begin offboarding, not only `assessed`) since the spec names contract expiry _or_
 * termination as triggers, and termination can happen before an assessment cycle finishes.
 */
const OFFBOARDING_INELIGIBLE_ENGAGEMENT_STATUSES = new Set([
  "offboarding",
  "closed",
]);

function assertActiveUser(
  user: { status?: string } | null,
  label: string,
): void {
  if (!user || user.status !== "active") {
    throw new ValidationError(
      `${label} does not resolve to an active internal user`,
    );
  }
}

/**
 * FLOW.md F5 step 1-2. Creates the offboarding checklist and atomically moves the
 * engagement and vendor into the offboarding lifecycle state — same transaction shape as
 * Phase 3's intake write (lib/services/vendor-intake.ts), for the same reason: two
 * documents must agree on "offboarding has started" or neither should.
 */
export async function initiateOffboarding(
  ctx: TenantContext,
  actor: OffboardingActor,
  engagementId: string,
  checklistItems: ChecklistItemSeed[],
) {
  if (!checklistItems || checklistItems.length === 0) {
    throw new ValidationError(
      "At least one checklist item is required to initiate offboarding",
    );
  }
  for (const item of checklistItems) {
    if (!item.label?.trim() || !item.owner_id) {
      throw new ValidationError(
        "Every checklist item needs a label and an owner_id",
      );
    }
  }

  await dbConnect();

  const engagementRepo = new EngagementRepository(ctx);
  const vendorRepo = new VendorRepository(ctx);
  const offboardingRepo = new OffboardingRepository(ctx);

  const engagement = await engagementRepo.findById(engagementId).lean();
  if (!engagement) {
    throw new NotFoundError(`Engagement ${engagementId} not found`);
  }
  if (OFFBOARDING_INELIGIBLE_ENGAGEMENT_STATUSES.has(engagement.status)) {
    throw new ValidationError(`Engagement is already ${engagement.status}`);
  }

  const existing = await offboardingRepo.findByEngagement(engagementId).lean();
  if (existing) {
    throw new ValidationError(
      "Offboarding has already been initiated for this engagement",
    );
  }

  const owners = await User.find({
    _id: { $in: checklistItems.map((i) => toObjectId(i.owner_id)) },
  }).lean();
  const ownerById = new Map(owners.map((u) => [u._id.toString(), u]));
  for (const item of checklistItems) {
    assertActiveUser(
      ownerById.get(item.owner_id) ?? null,
      `Checklist owner ${item.owner_id}`,
    );
  }

  const checklist = checklistItems.map((item) => ({
    item_id: new Types.ObjectId(),
    label: item.label.trim(),
    owner_id: toObjectId(item.owner_id),
    status: "pending" as const,
    completed_at: null,
  }));

  const session = await mongoose.startSession();
  try {
    const offboarding = await session.withTransaction(async () => {
      const created = await offboardingRepo.create(
        {
          engagement_id: engagement._id,
          vendor_id: engagement.vendor_id,
          checklist,
          destruction_certificate: null,
          asset_return_attestation: null,
          status: "initiated",
        },
        { session },
      );

      await engagementRepo.updateOne(
        { _id: engagement._id },
        { $set: { status: "offboarding" } },
        { session },
      );
      await vendorRepo.updateOne(
        { _id: engagement.vendor_id },
        { $set: { lifecycle_status: "offboarding" } },
        { session },
      );

      await recordAuditEvent(
        {
          workspace_id: engagement.workspace_id,
          actor: {
            type: "internal",
            id: toObjectId(actor.userId),
            email: null,
          },
          action: "offboarding.initiated",
          entity_type: "Offboarding",
          entity_id: created._id,
          diff: {
            engagement_id: engagement._id.toString(),
            checklist_items: checklist.length,
          },
        },
        { session },
      );

      return created;
    });

    return offboarding;
  } finally {
    await session.endSession();
  }
}

/** Recomputes `initiated → in_progress → verified` from the document's own state. Never
 * moves a document backward and never touches `archived` — that transition belongs solely
 * to `completeOffboarding()`. Safe to call after every checklist/certificate write. */
async function refreshReadiness(
  repo: OffboardingRepository,
  offboardingId: Types.ObjectId,
) {
  const doc = await repo.findById(offboardingId).lean();
  if (!doc || doc.status === "archived") return;

  const allDone =
    doc.checklist.length > 0 && doc.checklist.every((i) => i.status === "done");
  const certsVerified =
    Boolean(doc.destruction_certificate?.verified_at) &&
    Boolean(doc.asset_return_attestation?.verified_at);

  if (allDone && certsVerified) {
    await repo.advanceStatus(
      offboardingId,
      ["initiated", "in_progress"],
      "verified",
    );
  } else if (doc.status === "initiated") {
    await repo.advanceStatus(offboardingId, ["initiated"], "in_progress");
  }
}

export async function updateChecklistItem(
  ctx: TenantContext,
  actor: OffboardingActor,
  offboardingId: string,
  itemId: string,
  status: ChecklistItemStatus,
) {
  await dbConnect();
  const repo = new OffboardingRepository(ctx);
  const offboarding = await repo.findById(offboardingId).lean();
  if (!offboarding) {
    throw new NotFoundError(`Offboarding ${offboardingId} not found`);
  }
  if (offboarding.status === "archived") {
    throw new ValidationError(
      "This offboarding record is archived and cannot be modified",
    );
  }
  const item = offboarding.checklist.find(
    (i) => i.item_id?.toString() === itemId,
  );
  if (!item) {
    throw new NotFoundError(`Checklist item ${itemId} not found`);
  }

  await repo.updateChecklistItemFields(offboarding._id, itemId, {
    status,
    completed_at: status === "done" ? new Date() : null,
  });
  await refreshReadiness(repo, offboarding._id);

  await recordAuditEvent({
    workspace_id: offboarding.workspace_id,
    actor: { type: "internal", id: toObjectId(actor.userId), email: null },
    action: "offboarding.checklist_item_updated",
    entity_type: "Offboarding",
    entity_id: offboarding._id,
    diff: { item_id: itemId, status },
  });

  return {
    offboarding_id: offboarding._id.toString(),
    item_id: itemId,
    status,
  };
}

export interface UploadCertificateInput {
  filename: string;
  mime: string;
  body: Buffer;
}

export async function uploadOffboardingCertificate(
  ctx: TenantContext,
  actor: OffboardingActor,
  offboardingId: string,
  kind: CertificateKind,
  input: UploadCertificateInput,
) {
  validateUploadedFile({ mime: input.mime, size: input.body.byteLength });

  await dbConnect();
  const repo = new OffboardingRepository(ctx);
  const offboarding = await repo.findById(offboardingId).lean();
  if (!offboarding) {
    throw new NotFoundError(`Offboarding ${offboardingId} not found`);
  }
  if (offboarding.status === "archived") {
    throw new ValidationError(
      "This offboarding record is archived and cannot be modified",
    );
  }

  // Namespaced the same way vendor documents are (lib/services/vendor-documents.ts) —
  // defense in depth, not the authorization boundary. Retrieval re-derives authorization
  // from this offboarding record's own subdocument, never from the raw key.
  const key = `${offboarding.workspace_id.toString()}/offboarding/${offboarding._id.toString()}/${kind}/${randomUUID()}-${sanitizeFilename(input.filename)}`;
  const storage = getStorageDriver();
  await storage.put(key, input.body);

  const certificate = {
    file_key: key,
    uploaded_at: new Date(),
    verified_by: null,
    verified_at: null,
  };
  await repo.setCertificate(offboarding._id, kind, certificate);

  await recordAuditEvent({
    workspace_id: offboarding.workspace_id,
    actor: { type: "internal", id: toObjectId(actor.userId), email: null },
    action: "offboarding.certificate_uploaded",
    entity_type: "Offboarding",
    entity_id: offboarding._id,
    diff: { kind, filename: input.filename },
  });

  return certificate;
}

export async function verifyOffboardingCertificate(
  ctx: TenantContext,
  actor: OffboardingActor,
  offboardingId: string,
  kind: CertificateKind,
) {
  await dbConnect();
  const repo = new OffboardingRepository(ctx);
  const offboarding = await repo.findById(offboardingId).lean();
  if (!offboarding) {
    throw new NotFoundError(`Offboarding ${offboardingId} not found`);
  }
  if (offboarding.status === "archived") {
    throw new ValidationError(
      "This offboarding record is archived and cannot be modified",
    );
  }
  const existing = offboarding[kind];
  if (!existing?.file_key) {
    throw new ValidationError(
      `No ${kind.replace("_", " ")} has been uploaded yet`,
    );
  }

  await repo.verifyCertificate(offboarding._id, kind, toObjectId(actor.userId));
  await refreshReadiness(repo, offboarding._id);

  await recordAuditEvent({
    workspace_id: offboarding.workspace_id,
    actor: { type: "internal", id: toObjectId(actor.userId), email: null },
    action: "offboarding.certificate_verified",
    entity_type: "Offboarding",
    entity_id: offboarding._id,
    diff: { kind },
  });

  return { offboarding_id: offboarding._id.toString(), kind, verified: true };
}

export async function getOffboardingCertificateFile(
  ctx: TenantContext,
  offboardingId: string,
  kind: CertificateKind,
) {
  await dbConnect();
  const repo = new OffboardingRepository(ctx);
  const offboarding = await repo.findById(offboardingId).lean();
  if (!offboarding) {
    throw new NotFoundError(`Offboarding ${offboardingId} not found`);
  }
  const certificate = offboarding[kind];
  if (!certificate?.file_key) {
    throw new NotFoundError(`No ${kind.replace("_", " ")} uploaded`);
  }

  const storage = getStorageDriver();
  const body = await storage.get(certificate.file_key);
  return { certificate, body };
}

/**
 * FLOW.md F5 step 4-5, the terminal step. `CONSTRAINTS.md` #12 requires this to be the
 * *only* place an assessment/offboarding record ever becomes archived, and for that
 * archival to be irreversible through the normal API — enforced structurally by
 * `OffboardingRepository`'s and `AssessmentRepository.archive()`'s own status-scoped
 * filters, not just by this function checking first.
 */
export async function completeOffboarding(
  ctx: TenantContext,
  actor: OffboardingActor,
  offboardingId: string,
) {
  await dbConnect();

  const offboardingRepo = new OffboardingRepository(ctx);
  const engagementRepo = new EngagementRepository(ctx);
  const vendorRepo = new VendorRepository(ctx);
  const assessmentRepo = new AssessmentRepository(ctx);

  const offboarding = await offboardingRepo.findById(offboardingId).lean();
  if (!offboarding) {
    throw new NotFoundError(`Offboarding ${offboardingId} not found`);
  }
  if (offboarding.status === "archived") {
    throw new ValidationError(
      "This engagement has already completed offboarding",
    );
  }
  if (offboarding.status !== "verified") {
    throw new ValidationError(
      "Offboarding is not ready to archive — every checklist item must be done and both " +
        "certificates verified first",
    );
  }

  const assessments = await assessmentRepo
    .find({
      engagement_id: offboarding.engagement_id,
      status: { $ne: "archived" },
    })
    .lean();

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const result = await offboardingRepo.advanceStatus(
        offboarding._id,
        ["verified"],
        "archived",
        { session },
      );
      if (result.matchedCount === 0) {
        // Lost a race with another archive attempt between the read above and here — fail
        // loudly rather than proceed to archive assessments/close the engagement twice.
        throw new ValidationError(
          "Offboarding status changed before it could be archived",
        );
      }

      for (const assessment of assessments) {
        await assessmentRepo.archive(assessment._id, { session });
      }

      await engagementRepo.updateOne(
        { _id: offboarding.engagement_id },
        { $set: { status: "closed" } },
        { session },
      );
      await vendorRepo.updateOne(
        { _id: offboarding.vendor_id },
        { $set: { lifecycle_status: "terminated" } },
        { session },
      );

      await recordAuditEvent(
        {
          workspace_id: offboarding.workspace_id,
          actor: {
            type: "internal",
            id: toObjectId(actor.userId),
            email: null,
          },
          action: "offboarding.archived",
          entity_type: "Offboarding",
          entity_id: offboarding._id,
          diff: {
            assessments_archived: assessments.map((a) => a._id.toString()),
          },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return {
    offboarding_id: offboarding._id.toString(),
    status: "archived" as const,
  };
}

export async function getOffboardingView(
  ctx: TenantContext,
  engagementId: string,
) {
  await dbConnect();
  const offboardingRepo = new OffboardingRepository(ctx);
  const offboarding = await offboardingRepo
    .findByEngagement(engagementId)
    .lean();
  if (!offboarding) return null;

  const ownerIds = [
    ...new Set(offboarding.checklist.map((i) => i.owner_id.toString())),
  ];
  const owners = ownerIds.length
    ? await User.find({
        _id: { $in: ownerIds.map((id) => new Types.ObjectId(id)) },
      }).lean()
    : [];
  const ownerById = new Map(owners.map((u) => [u._id.toString(), u.name]));

  return {
    id: offboarding._id.toString(),
    engagement_id: offboarding.engagement_id.toString(),
    status: offboarding.status,
    checklist: offboarding.checklist.map((item) => ({
      item_id: item.item_id?.toString() ?? "",
      label: item.label,
      owner_id: item.owner_id.toString(),
      owner_name: ownerById.get(item.owner_id.toString()) ?? "Unknown user",
      status: item.status,
      completed_at: item.completed_at?.toISOString() ?? null,
    })),
    destruction_certificate: offboarding.destruction_certificate
      ? {
          uploaded_at:
            offboarding.destruction_certificate.uploaded_at.toISOString(),
          verified_at:
            offboarding.destruction_certificate.verified_at?.toISOString() ??
            null,
        }
      : null,
    asset_return_attestation: offboarding.asset_return_attestation
      ? {
          uploaded_at:
            offboarding.asset_return_attestation.uploaded_at.toISOString(),
          verified_at:
            offboarding.asset_return_attestation.verified_at?.toISOString() ??
            null,
        }
      : null,
  };
}
