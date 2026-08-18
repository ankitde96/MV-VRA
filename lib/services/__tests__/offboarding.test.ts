// @vitest-environment node
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { Vendor } from "@/lib/db/models/vendor";
import { Engagement } from "@/lib/db/models/engagement";
import { Assessment } from "@/lib/db/models/assessment";
import { User } from "@/lib/db/models/user";
import { Offboarding } from "@/lib/db/models/offboarding";
import { AuditEvent } from "@/lib/db/models/audit-event";
import { ValidationError } from "@/lib/errors";
import {
  completeOffboarding,
  getOffboardingView,
  initiateOffboarding,
  uploadOffboardingCertificate,
  updateChecklistItem,
  verifyOffboardingCertificate,
} from "@/lib/services/offboarding";
import { OffboardingRepository } from "@/lib/repositories/offboarding-repository";

/**
 * PLAN.md Phase 10 exit criterion (FLOW.md F5): initiate → checklist → certificates →
 * complete, and once archived, no code path can mutate the record — verified here against
 * a real MongoDB, the same discipline every other service in this codebase uses (not just
 * a real-HTTP-request check).
 */
describe("offboarding service (integration)", () => {
  const workspaceId = new Types.ObjectId();
  const vendorId = new Types.ObjectId();
  const engagementId = new Types.ObjectId();
  const businessOwnerId = new Types.ObjectId();
  const checklistOwnerId = new Types.ObjectId();

  async function seedFixtures(
    engagementStatus:
      | "draft"
      | "submitted"
      | "scoring_failed"
      | "tiered"
      | "in_assessment"
      | "assessed"
      | "offboarding"
      | "closed" = "assessed",
  ) {
    await Workspace.create({
      _id: workspaceId,
      entity_name: "Offboarding Test Workspace",
      slug: `offboarding-test-${workspaceId.toString()}`,
      settings: {
        risk_weights: {},
        weights_version: 1,
        tier_thresholds: { tier1_min: 70, tier2_min: 40 },
        enterprise_risk_categories: [],
      },
      status: "active",
    });

    await User.create({
      _id: checklistOwnerId,
      email: `checklist-owner-${checklistOwnerId.toString()}@offboarding-test.example`,
      name: "Checklist Owner",
      password_hash: "not-a-real-hash",
      memberships: [{ workspace_id: workspaceId, role: "admin" }],
      status: "active",
    });

    await Vendor.create({
      _id: vendorId,
      workspace_id: workspaceId,
      legal_name: "Offboarding Test Vendor",
      domain: `offboarding-test-${vendorId.toString()}.example`,
      spoc: {
        spoc_name: "S Poc",
        spoc_email: "spoc@offboarding-test.example",
        spoc_phone: "+1",
      },
      inherent_risk_tier: 2,
      lifecycle_status: "active",
    });

    await Engagement.create({
      _id: engagementId,
      workspace_id: workspaceId,
      vendor_id: vendorId,
      business_owner_id: businessOwnerId,
      business_unit: "Engineering",
      functional_scope: "Payments",
      expected_procurement_date: new Date("2026-09-01"),
      data_classification: ["pii"],
      inherent_risk_tier: 2,
      status: engagementStatus,
    });

    const assessment = await Assessment.create({
      workspace_id: workspaceId,
      engagement_id: engagementId,
      vendor_id: vendorId,
      template_id: new Types.ObjectId(),
      template_version: 1,
      template_snapshot: { schema_format_version: 1, sections: [] },
      status: "completed",
      overall_score: 10,
      submitted_at: new Date(),
      reviewed_at: new Date(),
    });

    return assessment;
  }

  afterEach(async () => {
    await Promise.all([
      Workspace.deleteMany({ _id: workspaceId }),
      Vendor.deleteMany({ workspace_id: workspaceId }),
      Engagement.deleteMany({ workspace_id: workspaceId }),
      Assessment.deleteMany({ workspace_id: workspaceId }),
      Offboarding.deleteMany({ workspace_id: workspaceId }),
      User.deleteMany({ _id: checklistOwnerId }),
      AuditEvent.deleteMany({ workspace_id: workspaceId }),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await rm(resolve(process.cwd(), ".storage-local"), {
      recursive: true,
      force: true,
    });
  });

  it("initiateOffboarding creates the checklist and moves engagement/vendor into offboarding atomically", async () => {
    await dbConnect();
    await seedFixtures();

    const offboarding = await initiateOffboarding(
      { workspaceId },
      { userId: businessOwnerId.toString() },
      engagementId.toString(),
      [
        {
          label: "Revoke system access",
          owner_id: checklistOwnerId.toString(),
        },
      ],
    );

    expect(offboarding.status).toBe("initiated");
    expect(offboarding.checklist).toHaveLength(1);

    const storedEngagement = await Engagement.findById(engagementId);
    const storedVendor = await Vendor.findById(vendorId);
    expect(storedEngagement?.status).toBe("offboarding");
    expect(storedVendor?.lifecycle_status).toBe("offboarding");

    const auditEntry = await AuditEvent.findOne({ entity_id: offboarding._id });
    expect(auditEntry?.action).toBe("offboarding.initiated");
  });

  it("refuses to initiate twice for the same engagement", async () => {
    await dbConnect();
    await seedFixtures();
    await initiateOffboarding(
      { workspaceId },
      { userId: businessOwnerId.toString() },
      engagementId.toString(),
      [
        {
          label: "Revoke system access",
          owner_id: checklistOwnerId.toString(),
        },
      ],
    );

    await expect(
      initiateOffboarding(
        { workspaceId },
        { userId: businessOwnerId.toString() },
        engagementId.toString(),
        [{ label: "Second attempt", owner_id: checklistOwnerId.toString() }],
      ),
    ).rejects.toThrow(ValidationError);
  });

  it(
    "walks checklist + certificates to verified, refuses to complete early, then archives " +
      "the offboarding record, its assessments, and closes the engagement/vendor",
    async () => {
      await dbConnect();
      await seedFixtures();
      const offboarding = await initiateOffboarding(
        { workspaceId },
        { userId: businessOwnerId.toString() },
        engagementId.toString(),
        [
          {
            label: "Revoke system access",
            owner_id: checklistOwnerId.toString(),
          },
        ],
      );
      const offboardingId = offboarding._id.toString();
      const itemId = offboarding.checklist[0].item_id!.toString();

      // Not ready yet — no checklist item done, no certificates.
      await expect(
        completeOffboarding(
          { workspaceId },
          { userId: businessOwnerId.toString() },
          offboardingId,
        ),
      ).rejects.toThrow(ValidationError);

      await updateChecklistItem(
        { workspaceId },
        { userId: businessOwnerId.toString() },
        offboardingId,
        itemId,
        "in_progress",
      );
      let stored = await Offboarding.findById(offboardingId);
      expect(stored?.status).toBe("in_progress");

      await updateChecklistItem(
        { workspaceId },
        { userId: businessOwnerId.toString() },
        offboardingId,
        itemId,
        "done",
      );

      // Checklist done but no certificates yet — still not ready.
      await expect(
        completeOffboarding(
          { workspaceId },
          { userId: businessOwnerId.toString() },
          offboardingId,
        ),
      ).rejects.toThrow(ValidationError);

      await uploadOffboardingCertificate(
        { workspaceId },
        { userId: businessOwnerId.toString() },
        offboardingId,
        "destruction_certificate",
        {
          filename: "destruction.pdf",
          mime: "application/pdf",
          body: Buffer.from("certificate-1"),
        },
      );
      await uploadOffboardingCertificate(
        { workspaceId },
        { userId: businessOwnerId.toString() },
        offboardingId,
        "asset_return_attestation",
        {
          filename: "asset-return.pdf",
          mime: "application/pdf",
          body: Buffer.from("certificate-2"),
        },
      );

      // Uploaded but not yet verified — still not ready.
      await expect(
        completeOffboarding(
          { workspaceId },
          { userId: businessOwnerId.toString() },
          offboardingId,
        ),
      ).rejects.toThrow(ValidationError);

      await verifyOffboardingCertificate(
        { workspaceId },
        { userId: businessOwnerId.toString() },
        offboardingId,
        "destruction_certificate",
      );
      await verifyOffboardingCertificate(
        { workspaceId },
        { userId: businessOwnerId.toString() },
        offboardingId,
        "asset_return_attestation",
      );

      stored = await Offboarding.findById(offboardingId);
      expect(stored?.status).toBe("verified");

      const view = await getOffboardingView(
        { workspaceId },
        engagementId.toString(),
      );
      expect(view?.status).toBe("verified");
      expect(view?.destruction_certificate?.verified_at).not.toBeNull();

      const result = await completeOffboarding(
        { workspaceId },
        { userId: businessOwnerId.toString() },
        offboardingId,
      );
      expect(result.status).toBe("archived");

      const archivedOffboarding = await Offboarding.findById(offboardingId);
      const archivedAssessment = await Assessment.findOne({
        engagement_id: engagementId,
      });
      const closedEngagement = await Engagement.findById(engagementId);
      const terminatedVendor = await Vendor.findById(vendorId);

      expect(archivedOffboarding?.status).toBe("archived");
      expect(archivedAssessment?.status).toBe("archived");
      expect(closedEngagement?.status).toBe("closed");
      expect(terminatedVendor?.lifecycle_status).toBe("terminated");

      // CONSTRAINTS.md #12 — an archived record cannot be mutated through its own
      // repository, structurally, not merely because the service checks first.
      const repo = new OffboardingRepository({ workspaceId });
      const rawResult = await repo.updateChecklistItemFields(
        offboardingId,
        itemId,
        {
          status: "pending",
        },
      );
      expect(rawResult.matchedCount).toBe(0);

      await expect(
        updateChecklistItem(
          { workspaceId },
          { userId: businessOwnerId.toString() },
          offboardingId,
          itemId,
          "pending",
        ),
      ).rejects.toThrow(ValidationError);
    },
  );
});
