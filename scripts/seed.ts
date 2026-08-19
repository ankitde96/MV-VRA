/**
 * Phase 1 seed — one workspace, one super-admin user, and a starter mitigation-guidance
 * library (PLAN.md Phase 1, step 5). Idempotent: re-running updates the same documents by
 * their natural keys (slug / email / control_pattern) rather than duplicating them.
 *
 * Development credentials are intentionally stable and documented in README.md. Production
 * continues to require the configured SUPER_ADMIN_PASSWORD_HASH.
 *
 * Phase 11 extension (`DECISIONS.md` 024): a second workspace plus three additional users of
 * varied roles, so RBAC and the workspace switcher have more than one account/tenant to
 * verify against locally. Their passwords are hashed fresh on every seed run from a fixed
 * dev-only string — never committed as a hash, and clearly not meant to resemble a
 * production credential.
 */
import argon2 from "argon2";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { env } from "@/lib/env";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import { MitigationGuidance } from "@/lib/db/models/mitigation-guidance";
import { Vendor } from "@/lib/db/models/vendor";
import {
  DEV_VENDOR_EMAIL,
  DEV_VENDOR_ID,
} from "@/lib/auth/dev-vendor-credentials";

const DEV_PASSWORD = "admin";
const NON_DEVELOPMENT_FIXTURE_PASSWORD = "dev-only-fixture-password-42";

const DEV_PLACEHOLDER_HASH = "dev-placeholder-not-a-real-argon2-hash";

async function main() {
  await dbConnect();

  const workspace = await Workspace.findOneAndUpdate(
    { slug: "default" },
    {
      // $set, not $setOnInsert — HANDOVER.md's Phase 2 lesson applies here too: an
      // $setOnInsert-only field silently stops updating the moment the document exists
      // once, so a workspace seeded before Phase 3 would otherwise never gain risk_weights
      // on a later `npm run db:seed`. Phase 3 (DECISIONS.md — network_exposure/
      // system_access_level/business_redundancy option sets and this weight shape are a
      // stated assumption, not from the spec). Without these, every intake in a fresh dev
      // environment would hit scoring_failed — DATA-MODEL.md §4's fail-loud rule working
      // exactly as designed, but not what a first demo needs.
      $set: {
        "settings.risk_weights": {
          data_classification: { pii: 30, phi: 30, financial: 20, none: 0 },
          network_exposure: { external: 25, internal: 10, none: 0 },
          system_access_level: { admin: 25, write: 15, read: 5, none: 0 },
          business_redundancy: {
            single_source: 20,
            some_redundancy: 10,
            fully_redundant: 0,
          },
        },
      },
      $setOnInsert: {
        entity_name: "MoneyView (default workspace)",
        slug: "default",
        "settings.weights_version": 1,
        "settings.tier_thresholds": { tier1_min: 70, tier2_min: 40 },
        "settings.enterprise_risk_categories": [],
        status: "active",
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  console.log(`Workspace ready: ${workspace.slug} (${workspace._id})`);

  const adminEmail = env.SUPER_ADMIN_EMAIL;
  const isDevelopment = env.NODE_ENV === "development";
  if (
    !isDevelopment &&
    env.SUPER_ADMIN_PASSWORD_HASH === DEV_PLACEHOLDER_HASH
  ) {
    console.warn(
      "SUPER_ADMIN_PASSWORD_HASH not set — seeding a placeholder hash that cannot " +
        "authenticate. Run `npm run hash-password -- '<password>'`, set the env var, and " +
        "re-run this seed.",
    );
  }

  const devPasswordHash = isDevelopment
    ? await argon2.hash(DEV_PASSWORD)
    : null;
  const superAdminPasswordHash =
    devPasswordHash ?? env.SUPER_ADMIN_PASSWORD_HASH;

  await User.findOneAndUpdate(
    { email: adminEmail },
    {
      $set: { password_hash: superAdminPasswordHash },
      $setOnInsert: {
        email: adminEmail,
        name: "Super Admin",
        memberships: [{ workspace_id: workspace._id, role: "admin" }],
        status: "active",
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  console.log(`Super-admin user ready: ${adminEmail}`);

  const secondWorkspace = await Workspace.findOneAndUpdate(
    { slug: "beta" },
    {
      $set: {
        "settings.risk_weights": {
          data_classification: { pii: 30, phi: 30, financial: 20, none: 0 },
          network_exposure: { external: 25, internal: 10, none: 0 },
          system_access_level: { admin: 25, write: 15, read: 5, none: 0 },
          business_redundancy: {
            single_source: 20,
            some_redundancy: 10,
            fully_redundant: 0,
          },
        },
      },
      $setOnInsert: {
        entity_name: "MoneyView Beta Subsidiary",
        slug: "beta",
        "settings.weights_version": 1,
        "settings.tier_thresholds": { tier1_min: 70, tier2_min: 40 },
        "settings.enterprise_risk_categories": [],
        status: "active",
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  console.log(
    `Second workspace ready: ${secondWorkspace.slug} (${secondWorkspace._id})`,
  );

  const fixturePasswordHash =
    devPasswordHash ?? (await argon2.hash(NON_DEVELOPMENT_FIXTURE_PASSWORD));
  const fixtureUsers: {
    email: string;
    name: string;
    memberships: { workspace_id: unknown; role: string }[];
  }[] = [
    {
      email: "analyst@mv-vra.local",
      name: "Risk Analyst (dev fixture)",
      memberships: [{ workspace_id: workspace._id, role: "risk_analyst" }],
    },
    {
      email: "business-owner@mv-vra.local",
      name: "Business Owner (dev fixture)",
      memberships: [{ workspace_id: workspace._id, role: "business_owner" }],
    },
    {
      email: "multi-workspace-admin@mv-vra.local",
      name: "Multi-Workspace Admin (dev fixture)",
      memberships: [
        { workspace_id: workspace._id, role: "admin" },
        { workspace_id: secondWorkspace._id, role: "admin" },
      ],
    },
  ];
  for (const fixture of fixtureUsers) {
    await User.findOneAndUpdate(
      { email: fixture.email },
      {
        $set: { password_hash: fixturePasswordHash },
        $setOnInsert: {
          email: fixture.email,
          name: fixture.name,
          memberships: fixture.memberships,
          status: "active",
        },
      },
      { upsert: true, returnDocument: "after" },
    );
  }
  console.log(
    `${fixtureUsers.length} dev-fixture users ready (development password documented in README.md).`,
  );

  if (isDevelopment) {
    const existingDevVendor = await Vendor.findById(DEV_VENDOR_ID).lean();
    // ASSESSMENT-WORKFLOW-PLAN.md Stage 2 — spocs[] only set on first insert (via
    // $setOnInsert below), same as every other insert-only fixture field here, so
    // re-running the seed never clobbers SPOC edits made by hand while developing. A
    // second SPOC is seeded deliberately (not just one) so local verification can exercise
    // per-SPOC portal scoping without needing to add one manually first.
    const shouldSeedSpocs = !existingDevVendor?.spocs?.length;
    const setFields: Record<string, unknown> = {
      workspace_id: workspace._id,
      spoc: {
        spoc_name: "Demo Vendor SPOC",
        spoc_email: DEV_VENDOR_EMAIL,
        spoc_phone: "+91-0000000000",
      },
    };
    if (shouldSeedSpocs) {
      setFields.spocs = [
        {
          name: "Demo Vendor SPOC",
          email: DEV_VENDOR_EMAIL,
          phone: "+91-0000000000",
          is_primary: true,
          status: "active",
        },
        {
          name: "Demo Vendor Secondary SPOC",
          email: "vendor2@mv-vra.local",
          phone: "+91-0000000001",
          is_primary: false,
          status: "active",
        },
      ];
    }
    const vendor = await Vendor.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(DEV_VENDOR_ID) },
      {
        $set: setFields,
        $setOnInsert: {
          legal_name: "MV-VRA Demo Vendor",
          domain: "vendor.demo.mv-vra.local",
          inherent_risk_tier: 2,
          lifecycle_status: "active",
          documents: [],
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    console.log(
      `Development vendor ready: ${vendor._id} (${DEV_VENDOR_EMAIL})`,
    );
  }

  const guidanceSeed = [
    {
      control_pattern: "HOST-*",
      failure_condition:
        "No documented data residency or hosting region control",
      suggested_remediation:
        "Request written confirmation of hosting region and data residency commitments from the vendor.",
      references: [],
    },
    {
      control_pattern: "ACCESS-*",
      failure_condition:
        "No multi-factor authentication on privileged accounts",
      suggested_remediation:
        "Require MFA enforcement on all accounts with access to in-scope systems as a compensating control.",
      references: [],
    },
  ];

  for (const entry of guidanceSeed) {
    await MitigationGuidance.findOneAndUpdate(
      { control_pattern: entry.control_pattern },
      { $setOnInsert: entry },
      { upsert: true },
    );
  }
  console.log(
    `Mitigation guidance library ready: ${guidanceSeed.length} entr(y/ies).`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
