// @vitest-environment node
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { Vendor } from "@/lib/db/models/vendor";
import { SharedDocument } from "@/lib/db/models/shared-document";
import { AuditEvent } from "@/lib/db/models/audit-event";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { uploadVendorDocument } from "@/lib/services/vendor-documents";
import {
  listSharesAvailableToMe,
  listSharesGrantedByMe,
  readSharedDocument,
  revokeVendorDocumentShare,
  shareVendorDocument,
} from "@/lib/services/sharing";

/**
 * `PLAN.md` Phase 11 step 2. `SharedDocument` (`lib/db/models/shared-document.ts`) existed
 * unused since Phase 1 — this is the first exercise of it against a real database, including
 * the property its own schema comment calls out: every read is audited
 * (`CONSTRAINTS.md` #8's one sanctioned cross-tenant path).
 */
describe("sharing service (integration)", () => {
  const ownerWorkspaceId = new Types.ObjectId();
  const targetWorkspaceId = new Types.ObjectId();
  const unrelatedWorkspaceId = new Types.ObjectId();
  const ownerUserId = new Types.ObjectId();
  const vendorId = new Types.ObjectId();
  const vendorDomain = `sharing-test-${vendorId.toString()}.example`;
  let documentId: string;

  beforeAll(async () => {
    await dbConnect();
    await Workspace.create([
      {
        _id: ownerWorkspaceId,
        entity_name: "Sharing Owner Workspace",
        slug: `sharing-owner-${ownerWorkspaceId.toString()}`,
        settings: {
          weights_version: 1,
          tier_thresholds: { tier1_min: 70, tier2_min: 40 },
          enterprise_risk_categories: [],
        },
        status: "active",
      },
      {
        _id: targetWorkspaceId,
        entity_name: "Sharing Target Workspace",
        slug: `sharing-target-${targetWorkspaceId.toString()}`,
        settings: {
          weights_version: 1,
          tier_thresholds: { tier1_min: 70, tier2_min: 40 },
          enterprise_risk_categories: [],
        },
        status: "active",
      },
      {
        _id: unrelatedWorkspaceId,
        entity_name: "Sharing Unrelated Workspace",
        slug: `sharing-unrelated-${unrelatedWorkspaceId.toString()}`,
        settings: {
          weights_version: 1,
          tier_thresholds: { tier1_min: 70, tier2_min: 40 },
          enterprise_risk_categories: [],
        },
        status: "active",
      },
    ]);

    await Vendor.create({
      _id: vendorId,
      workspace_id: ownerWorkspaceId,
      legal_name: "Sharing Test Vendor",
      domain: vendorDomain,
      spoc: {
        spoc_name: "S Poc",
        spoc_email: "spoc@sharing-test.example",
        spoc_phone: "+1",
      },
      inherent_risk_tier: 2,
      lifecycle_status: "active",
    });

    const document = await uploadVendorDocument(
      { workspaceId: ownerWorkspaceId },
      { userId: ownerUserId.toString() },
      vendorId.toString(),
      {
        filename: "soc2-report.pdf",
        mime: "application/pdf",
        body: Buffer.from("fixture pdf"),
      },
    );
    documentId = document._id.toString();
  });

  afterAll(async () => {
    await SharedDocument.deleteMany({ owner_workspace_id: ownerWorkspaceId });
    await AuditEvent.deleteMany({ entity_type: "SharedDocument" });
    await Vendor.deleteOne({ _id: vendorId });
    await Workspace.deleteMany({
      _id: { $in: [ownerWorkspaceId, targetWorkspaceId, unrelatedWorkspaceId] },
    });
    await mongoose.disconnect();
    await rm(
      resolve(process.cwd(), ".storage-local", ownerWorkspaceId.toString()),
      {
        recursive: true,
        force: true,
      },
    );
  });

  it("grants a share and makes it visible to the target workspace but not an unrelated one", async () => {
    await shareVendorDocument(
      { workspaceId: ownerWorkspaceId },
      { userId: ownerUserId.toString() },
      {
        vendorId: vendorId.toString(),
        documentId,
        targetWorkspaceIds: [targetWorkspaceId.toString()],
      },
    );

    const availableToTarget = await listSharesAvailableToMe({
      workspaceId: targetWorkspaceId,
    });
    expect(availableToTarget).toHaveLength(1);
    expect(availableToTarget[0]!.vendor_domain).toBe(vendorDomain);

    const availableToUnrelated = await listSharesAvailableToMe({
      workspaceId: unrelatedWorkspaceId,
    });
    expect(availableToUnrelated).toHaveLength(0);
  });

  it("lists the share in the owner workspace management view", async () => {
    const granted = await listSharesGrantedByMe({
      workspaceId: ownerWorkspaceId,
    });
    expect(granted).toHaveLength(1);
    expect(granted[0]!.shared_with.map((w) => w.workspace_id)).toContain(
      targetWorkspaceId.toString(),
    );
  });

  it("refuses to share a document with the owner workspace itself", async () => {
    await expect(
      shareVendorDocument(
        { workspaceId: ownerWorkspaceId },
        { userId: ownerUserId.toString() },
        {
          vendorId: vendorId.toString(),
          documentId,
          targetWorkspaceIds: [ownerWorkspaceId.toString()],
        },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("lets the authorized target workspace actually read the file and records an audit event", async () => {
    const shared = await listSharesGrantedByMe({
      workspaceId: ownerWorkspaceId,
    });
    const shareId = shared[0]!.id;

    const beforeCount = await AuditEvent.countDocuments({
      entity_type: "SharedDocument",
    });

    const { document } = await readSharedDocument(
      { workspaceId: targetWorkspaceId },
      { userId: new Types.ObjectId().toString() },
      shareId,
    );
    expect(document.filename).toBe("soc2-report.pdf");

    const afterCount = await AuditEvent.countDocuments({
      entity_type: "SharedDocument",
    });
    expect(afterCount).toBe(beforeCount + 1);
  });

  it("refuses a read attempt from a workspace the document was never shared with", async () => {
    const shared = await listSharesGrantedByMe({
      workspaceId: ownerWorkspaceId,
    });
    const shareId = shared[0]!.id;

    await expect(
      readSharedDocument(
        { workspaceId: unrelatedWorkspaceId },
        { userId: new Types.ObjectId().toString() },
        shareId,
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("revoking removes the target workspace from shared_with and blocks further reads", async () => {
    const shared = await listSharesGrantedByMe({
      workspaceId: ownerWorkspaceId,
    });
    const shareId = shared[0]!.id;

    await revokeVendorDocumentShare(
      { workspaceId: ownerWorkspaceId },
      { userId: ownerUserId.toString() },
      shareId,
      targetWorkspaceId.toString(),
    );

    await expect(
      readSharedDocument(
        { workspaceId: targetWorkspaceId },
        { userId: new Types.ObjectId().toString() },
        shareId,
      ),
    ).rejects.toThrow(ForbiddenError);
  });
});
