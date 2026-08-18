/**
 * Phase 1 seed — one workspace, one super-admin user, and a starter mitigation-guidance
 * library (PLAN.md Phase 1, step 5). Idempotent: re-running updates the same documents by
 * their natural keys (slug / email / control_pattern) rather than duplicating them.
 *
 * The super-admin password hash comes from lib/env.ts (SUPER_ADMIN_PASSWORD_HASH), never
 * hardcoded here — a seed script is still code that could get committed. If it's still the
 * dev placeholder (env.ts's default), a warning is printed; that placeholder cannot
 * authenticate by design (lib/auth/login.ts, Phase 2) — see scripts/hash-password.ts to
 * generate a real one.
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

const DEV_FIXTURE_PASSWORD = "dev-only-fixture-password-42";

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
  if (env.SUPER_ADMIN_PASSWORD_HASH === DEV_PLACEHOLDER_HASH) {
    console.warn(
      "SUPER_ADMIN_PASSWORD_HASH not set — seeding a placeholder hash that cannot " +
        "authenticate. Run `npm run hash-password -- '<password>'`, set the env var, and " +
        "re-run this seed.",
    );
  }

  await User.findOneAndUpdate(
    { email: adminEmail },
    {
      $set: { password_hash: env.SUPER_ADMIN_PASSWORD_HASH },
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

  const fixturePasswordHash = await argon2.hash(DEV_FIXTURE_PASSWORD);
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
    `${fixtureUsers.length} dev-fixture users ready (password: "${DEV_FIXTURE_PASSWORD}", dev-only).`,
  );

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
