/**
 * UI Revamp Round 2, Phase C (`docs/UI-REVAMP-2-PLAN.md`, `DECISIONS.md` 030) — demo-volume
 * data so the new dashboard/rollup/scorecard charts render something real instead of an
 * empty state. Deliberately separate from `scripts/seed.ts` (auth bootstrap, run on every
 * fresh environment) — this is dev-only visual-verification data, opt-in via its own
 * `npm run db:seed-demo`, and never referenced by any test.
 *
 * Idempotent by domain suffix: every demo vendor's domain ends in `.demo.mv-vra.local`, and
 * a re-run deletes every vendor/engagement/assessment/risk under that suffix before
 * recreating them, rather than accumulating duplicates on repeat runs.
 */
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import { Vendor } from "@/lib/db/models/vendor";
import { Engagement } from "@/lib/db/models/engagement";
import { Assessment } from "@/lib/db/models/assessment";
import { Risk } from "@/lib/db/models/risk";
import { Offboarding } from "@/lib/db/models/offboarding";

const DEMO_SUFFIX = ".demo.mv-vra.local";
const now = Date.now();
const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);
const futureDays = (n: number) => new Date(now + n * 24 * 60 * 60 * 1000);

interface VendorSpec {
  name: string;
  domain: string;
  tier: 1 | 2 | 3 | null;
  singleSource?: boolean;
  dataClassification?: ("pii" | "phi" | "financial" | "none")[];
}

const VENDOR_SPECS: VendorSpec[] = [
  {
    name: "Apex Cloud Systems",
    domain: `apex-cloud${DEMO_SUFFIX}`,
    tier: 1,
    singleSource: true,
    dataClassification: ["pii", "financial"],
  },
  {
    name: "Meridian Payments Gateway",
    domain: `meridian-payments${DEMO_SUFFIX}`,
    tier: 1,
    singleSource: true,
    dataClassification: ["financial"],
  },
  {
    name: "Northwind Data Analytics",
    domain: `northwind-analytics${DEMO_SUFFIX}`,
    tier: 1,
    dataClassification: ["pii"],
  },
  {
    name: "Sablecrest Identity Platform",
    domain: `sablecrest-id${DEMO_SUFFIX}`,
    tier: 1,
    dataClassification: ["pii", "phi"],
  },
  {
    name: "Beacon HR Suite",
    domain: `beacon-hr${DEMO_SUFFIX}`,
    tier: 2,
    dataClassification: ["pii"],
  },
  {
    name: "Ferro Logistics Tracker",
    domain: `ferro-logistics${DEMO_SUFFIX}`,
    tier: 2,
    dataClassification: ["none"],
  },
  {
    name: "Glenwood Document Storage",
    domain: `glenwood-docs${DEMO_SUFFIX}`,
    tier: 2,
    dataClassification: ["pii"],
  },
  {
    name: "Ironbridge Support Desk",
    domain: `ironbridge-support${DEMO_SUFFIX}`,
    tier: 2,
    dataClassification: ["none"],
  },
  {
    name: "Cobalt Marketing Automation",
    domain: `cobalt-marketing${DEMO_SUFFIX}`,
    tier: 3,
    dataClassification: ["none"],
  },
  {
    name: "Driftwood Survey Tools",
    domain: `driftwood-survey${DEMO_SUFFIX}`,
    tier: 3,
    dataClassification: ["none"],
  },
  {
    name: "Pinecone Print Services",
    domain: `pinecone-print${DEMO_SUFFIX}`,
    tier: 3,
    dataClassification: ["none"],
  },
  {
    name: "Latchkey Facilities Vendor",
    domain: `latchkey-facilities${DEMO_SUFFIX}`,
    tier: null,
    dataClassification: ["none"],
  },
];

async function main() {
  await dbConnect();

  const workspace = await Workspace.findOne({ slug: "default" });
  if (!workspace) {
    throw new Error(
      "Default workspace not found — run `npm run db:seed` first.",
    );
  }
  const admin = await User.findOne({
    memberships: { $elemMatch: { workspace_id: workspace._id, role: "admin" } },
  });
  if (!admin) {
    throw new Error("No admin user found in the default workspace.");
  }

  // Clean slate for demo data only — never touches non-demo vendors/engagements.
  const existingDemoVendors = await Vendor.find({
    workspace_id: workspace._id,
    domain: { $regex: DEMO_SUFFIX.replace(/\./g, "\\.") + "$" },
  }).select("_id");
  const existingIds = existingDemoVendors.map((v) => v._id);
  if (existingIds.length > 0) {
    const engagements = await Engagement.find({
      vendor_id: { $in: existingIds },
    }).select("_id");
    const engagementIds = engagements.map((e) => e._id);
    await Promise.all([
      Assessment.deleteMany({ vendor_id: { $in: existingIds } }),
      Risk.deleteMany({ vendor_id: { $in: existingIds } }),
      Offboarding.deleteMany({ vendor_id: { $in: existingIds } }),
      Engagement.deleteMany({ vendor_id: { $in: existingIds } }),
      Vendor.deleteMany({ _id: { $in: existingIds } }),
    ]);
    void engagementIds;
  }

  const templateId = new Types.ObjectId();
  const schemaSnapshot = {
    schema_format_version: 1,
    sections: [] as unknown[],
  };

  const severities: Array<"critical" | "high" | "medium" | "low"> = [
    "critical",
    "high",
    "medium",
    "low",
  ];

  let vendorIndex = 0;
  for (const spec of VENDOR_SPECS) {
    vendorIndex += 1;
    const vendor = await Vendor.create({
      workspace_id: workspace._id,
      legal_name: spec.name,
      domain: spec.domain,
      spoc: {
        spoc_name: `${spec.name} SPOC`,
        spoc_email: `spoc@${spec.domain}`,
        spoc_phone: "+15550100000",
      },
      inherent_risk_tier: spec.tier,
      lifecycle_status: "active",
    });

    const inherentTotal =
      spec.tier === 1 ? 85 : spec.tier === 2 ? 55 : spec.tier === 3 ? 25 : null;

    const engagement = await Engagement.create({
      workspace_id: workspace._id,
      vendor_id: vendor._id,
      business_owner_id: admin._id,
      business_unit: "Operations",
      functional_scope: "Demo fixture engagement",
      expected_procurement_date: futureDays(60),
      data_classification: spec.dataClassification ?? ["none"],
      inherent_score:
        inherentTotal !== null
          ? {
              total: inherentTotal,
              breakdown: {},
              weights_version: 1,
              weights_snapshot: {
                business_redundancy: spec.singleSource
                  ? "single_source"
                  : "some_redundancy",
              },
            }
          : {},
      inherent_risk_tier: spec.tier,
      status: spec.tier !== null ? "in_assessment" : "tiered",
    });

    if (spec.tier === null) continue; // unscored vendor: no assessment/risk history

    // Assessment mix, staggered by vendor index so the trend charts show real variation.
    const cycleOffset = vendorIndex * 7;

    if (vendorIndex % 4 === 0) {
      // Portal stall: sent, past due, never submitted.
      await Assessment.create({
        workspace_id: workspace._id,
        engagement_id: engagement._id,
        vendor_id: vendor._id,
        template_id: templateId,
        template_version: 1,
        template_snapshot: schemaSnapshot,
        status: "sent",
        assigned_at: days(cycleOffset + 20),
        due_date: days(cycleOffset + 5),
      });
    } else {
      const assignedAt = days(cycleOffset + 40);
      const dueDate = days(cycleOffset + 19);
      const submittedAt = days(cycleOffset + (vendorIndex % 3 === 0 ? 12 : 22)); // some late
      const reviewedAt = days(cycleOffset + 5);
      const cadenceMonths = spec.tier === 1 ? 12 : spec.tier === 2 ? 18 : 24;
      // next_review_due is computed from reviewed_at + cadence like the real service does
      // (assessment-review.ts completeReview()) — but for half of Tier-1 vendors we want
      // the demo data to show a REASSESSMENT ALREADY OVERDUE. Rather than back-dating
      // reviewed_at itself (which would corrupt cycle-time chronology — reviewed_at must
      // stay after submitted_at), we push next_review_due itself into the past directly,
      // exactly as if this assessment had actually been reviewed that cadence ago.
      const overdueReassessment = spec.tier === 1 && vendorIndex % 2 === 0;
      const nextReviewDue = overdueReassessment
        ? days(30)
        : new Date(
            reviewedAt.getFullYear(),
            reviewedAt.getMonth() + cadenceMonths,
            reviewedAt.getDate(),
          );

      await Assessment.create({
        workspace_id: workspace._id,
        engagement_id: engagement._id,
        vendor_id: vendor._id,
        template_id: templateId,
        template_version: 1,
        template_snapshot: schemaSnapshot,
        status: "completed",
        assigned_at: assignedAt,
        due_date: dueDate,
        submitted_at: submittedAt,
        reviewed_at: reviewedAt,
        next_review_due: nextReviewDue,
      });
    }

    // Risks: 0-3 per vendor, varied severity/age/status, so aging buckets + severity
    // counts + the residual-exposure trend all have real spread.
    const riskCount = spec.tier === 1 ? 3 : spec.tier === 2 ? 2 : 1;
    for (let i = 0; i < riskCount; i++) {
      const severity = severities[(vendorIndex + i) % severities.length]!;
      const ageDays = [5, 45, 75, 110][(vendorIndex + i) % 4]!;
      const isClosed = (vendorIndex + i) % 5 === 0;
      const residualScore =
        severity === "critical"
          ? 78
          : severity === "high"
            ? 58
            : severity === "medium"
              ? 34
              : 15;

      const risk = await Risk.create({
        workspace_id: workspace._id,
        assessment_id: new Types.ObjectId(),
        engagement_id: engagement._id,
        vendor_id: vendor._id,
        control_id: `DEMO-${vendorIndex}-${i}`,
        title: `${spec.name}: ${severity} finding ${i + 1}`,
        description: "Demo fixture risk for dashboard visual verification.",
        severity,
        enterprise_risk_category: "Information Security",
        impact_level: severity === "critical" ? "critical" : "medium",
        residual_score: residualScore,
        status: isClosed ? "closed" : i === 0 ? "open" : "mitigating",
        closed_at: isClosed ? days(ageDays - 10) : null,
        created_at: days(ageDays),
      });

      // Give the first risk on Tier 1/2 vendors a CAP task — one overdue, one closed.
      if (i === 0 && (spec.tier === 1 || spec.tier === 2)) {
        const capOverdue = vendorIndex % 3 !== 0;
        await Risk.updateOne(
          { _id: risk._id },
          {
            $push: {
              cap_tasks: capOverdue
                ? {
                    description: "Remediate finding per vendor commitment",
                    owner_type: "internal",
                    owner_ref: admin._id,
                    due_date: days(15),
                    status: "overdue",
                  }
                : {
                    // task_id's auto-generated ObjectId embeds a creation timestamp of
                    // "now" (this script's run time) — MTTR is closed_at minus that, so
                    // closed_at must be AFTER now, not backdated, or MTTR goes negative.
                    description: "Remediate finding per vendor commitment",
                    owner_type: "internal",
                    owner_ref: admin._id,
                    due_date: futureDays(10),
                    status: "closed",
                    closed_at: futureDays(4),
                  },
            },
          },
        );
      }
    }
  }

  // One offboarding hygiene gap: archived without a verified destruction certificate.
  const hygieneGapVendor = await Vendor.findOne({
    workspace_id: workspace._id,
    domain: `pinecone-print${DEMO_SUFFIX}`,
  });
  if (hygieneGapVendor) {
    const eng = await Engagement.findOne({ vendor_id: hygieneGapVendor._id });
    if (eng) {
      await Offboarding.create({
        workspace_id: workspace._id,
        engagement_id: eng._id,
        vendor_id: hygieneGapVendor._id,
        checklist: [],
        destruction_certificate: {
          file_key: "demo/not-a-real-file",
          uploaded_at: days(20),
          verified_by: null,
          verified_at: null,
        },
        status: "archived",
      });
    }
  }

  console.log(
    `Demo data ready: ${VENDOR_SPECS.length} vendors under workspace "${workspace.slug}".`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
