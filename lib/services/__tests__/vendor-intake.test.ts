// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { Vendor } from "@/lib/db/models/vendor";
import { Engagement } from "@/lib/db/models/engagement";
import { AuditEvent } from "@/lib/db/models/audit-event";
import {
  submitVendorIntake,
  type VendorIntakeInput,
} from "@/lib/services/vendor-intake";

/**
 * TEST-CHECKLIST.md Gate 2 / DATA-MODEL.md §5: verified against a real database and a real
 * transaction, not by reading the code. Requires the local mongod to be a replica set
 * (DECISIONS.md 014) — a standalone mongod rejects startTransaction() outright, which would
 * surface here as a clear failure, not a silent skip.
 */
describe("submitVendorIntake (integration)", () => {
  const workspaceId = new Types.ObjectId();
  const actorUserId = new Types.ObjectId();

  const baseInput: Omit<VendorIntakeInput, "domain" | "legal_name"> = {
    spoc: {
      spoc_name: "A Spoc",
      spoc_email: "spoc@vendor-intake-test.example",
      spoc_phone: "+10000000000",
    },
    business_unit: "Engineering",
    functional_scope: "Payment processing",
    expected_procurement_date: new Date("2026-09-01"),
    data_classification: ["pii"],
    network_exposure: "external",
    system_access_level: "admin",
    business_redundancy: "single_source",
  };

  async function createWorkspace(riskWeights: Record<string, unknown>) {
    return Workspace.create({
      _id: workspaceId,
      entity_name: "Intake Test Workspace",
      slug: `intake-test-${workspaceId.toString()}`,
      settings: {
        risk_weights: riskWeights,
        weights_version: 1,
        tier_thresholds: { tier1_min: 70, tier2_min: 40 },
        enterprise_risk_categories: [],
      },
      status: "active",
    });
  }

  afterEach(async () => {
    await Promise.all([
      Workspace.deleteMany({ _id: workspaceId }),
      Vendor.deleteMany({ workspace_id: workspaceId }),
      Engagement.deleteMany({ workspace_id: workspaceId }),
      AuditEvent.deleteMany({ workspace_id: workspaceId }),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("writes Vendor + Engagement atomically and tiers a scoreable intake", async () => {
    await dbConnect();
    await createWorkspace({
      data_classification: { pii: 30, phi: 30, financial: 20, none: 0 },
      network_exposure: { external: 25, internal: 10, none: 0 },
      system_access_level: { admin: 25, write: 15, read: 5, none: 0 },
      business_redundancy: {
        single_source: 20,
        some_redundancy: 10,
        fully_redundant: 0,
      },
    });

    const { vendor, engagement } = await submitVendorIntake(
      { workspaceId },
      { userId: actorUserId.toString(), workspaceId: workspaceId.toString() },
      {
        ...baseInput,
        legal_name: "Acme Test Vendor",
        domain: "acme-intake-test.example",
      },
    );

    expect(vendor.inherent_risk_tier).toBe(1);
    expect(engagement.status).toBe("tiered");
    expect(engagement.inherent_risk_tier).toBe(1);
    expect(engagement.vendor_id.toString()).toBe(vendor._id.toString());

    const storedVendor = await Vendor.findById(vendor._id);
    const storedEngagement = await Engagement.findById(engagement._id);
    expect(storedVendor?.inherent_risk_tier).toBe(1);
    expect(storedEngagement?.status).toBe("tiered");

    const auditEntry = await AuditEvent.findOne({ entity_id: engagement._id });
    expect(auditEntry?.action).toBe("engagement.intake_submitted");
  });

  it("lands in scoring_failed with a null tier, never a fabricated default, when a value is unmappable", async () => {
    await dbConnect();
    // Deliberately missing a weight for `network_exposure: external`.
    await createWorkspace({
      data_classification: { pii: 30 },
      network_exposure: {},
      system_access_level: { admin: 25 },
      business_redundancy: { single_source: 20 },
    });

    const { vendor, engagement } = await submitVendorIntake(
      { workspaceId },
      { userId: actorUserId.toString(), workspaceId: workspaceId.toString() },
      {
        ...baseInput,
        legal_name: "Unscoreable Test Vendor",
        domain: "unscoreable-intake-test.example",
      },
    );

    expect(vendor.inherent_risk_tier).toBeNull();
    expect(engagement.status).toBe("scoring_failed");
    expect(engagement.inherent_risk_tier).toBeNull();

    const storedVendor = await Vendor.findById(vendor._id);
    expect(storedVendor?.inherent_risk_tier).toBeNull();
  });
});
