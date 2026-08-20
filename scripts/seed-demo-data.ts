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
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mongoose, { Types, type HydratedDocument } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import { Vendor } from "@/lib/db/models/vendor";
import { Engagement } from "@/lib/db/models/engagement";
import { Assessment, type AssessmentDoc } from "@/lib/db/models/assessment";
import { Risk } from "@/lib/db/models/risk";
import { Offboarding } from "@/lib/db/models/offboarding";
import { Response } from "@/lib/db/models/response";
import { AssessmentReviewService } from "@/lib/services/assessment-review";
import { getStorageDriver } from "@/lib/storage";
import { validateUploadedFile } from "@/lib/uploads/constraints";
import {
  buildDemoResponseSpecs,
  DEMO_EVIDENCE_FIXTURES,
  DEMO_QUESTIONS_SCHEMA,
  parseDemoSeedArgs,
} from "./demo-data-spec";

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
  compliantControls: number;
}

const VENDOR_SPECS: VendorSpec[] = [
  {
    name: "Apex Cloud Systems",
    domain: `apex-cloud${DEMO_SUFFIX}`,
    tier: 1,
    singleSource: true,
    dataClassification: ["pii", "financial"],
    compliantControls: 23,
  },
  {
    name: "Meridian Payments Gateway",
    domain: `meridian-payments${DEMO_SUFFIX}`,
    tier: 1,
    singleSource: true,
    dataClassification: ["financial"],
    compliantControls: 20,
  },
  {
    name: "Northwind Data Analytics",
    domain: `northwind-analytics${DEMO_SUFFIX}`,
    tier: 1,
    dataClassification: ["pii"],
    compliantControls: 18,
  },
  {
    name: "Sablecrest Identity Platform",
    domain: `sablecrest-id${DEMO_SUFFIX}`,
    tier: 1,
    dataClassification: ["pii", "phi"],
    compliantControls: 15,
  },
  {
    name: "Beacon HR Suite",
    domain: `beacon-hr${DEMO_SUFFIX}`,
    tier: 2,
    dataClassification: ["pii"],
    compliantControls: 22,
  },
  {
    name: "Ferro Logistics Tracker",
    domain: `ferro-logistics${DEMO_SUFFIX}`,
    tier: 2,
    dataClassification: ["none"],
    compliantControls: 19,
  },
  {
    name: "Glenwood Document Storage",
    domain: `glenwood-docs${DEMO_SUFFIX}`,
    tier: 2,
    dataClassification: ["pii"],
    compliantControls: 17,
  },
  {
    name: "Ironbridge Support Desk",
    domain: `ironbridge-support${DEMO_SUFFIX}`,
    tier: 2,
    dataClassification: ["none"],
    compliantControls: 15,
  },
  {
    name: "Cobalt Marketing Automation",
    domain: `cobalt-marketing${DEMO_SUFFIX}`,
    tier: 3,
    dataClassification: ["none"],
    compliantControls: 23,
  },
  {
    name: "Driftwood Survey Tools",
    domain: `driftwood-survey${DEMO_SUFFIX}`,
    tier: 3,
    dataClassification: ["none"],
    compliantControls: 20,
  },
  {
    name: "Pinecone Print Services",
    domain: `pinecone-print${DEMO_SUFFIX}`,
    tier: 3,
    dataClassification: ["none"],
    compliantControls: 15,
  },
  {
    name: "Latchkey Facilities Vendor",
    domain: `latchkey-facilities${DEMO_SUFFIX}`,
    tier: null,
    dataClassification: ["none"],
    compliantControls: 0,
  },
];

async function main() {
  const { resetStorage } = parseDemoSeedArgs(process.argv.slice(2));
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

  const storage = getStorageDriver();
  const storagePrefix = `${workspace._id.toString()}/reviewer-demo-v2`;
  if (resetStorage) {
    const keys = await storage.list(storagePrefix);
    await Promise.all(keys.map((key) => storage.delete(key)));
    console.log(`Reset ${keys.length} demo evidence object(s).`);
  }

  // Clean slate for demo data only — never touches non-demo vendors/engagements. Resolve
  // every dependent id from the suffix-scoped vendor set before issuing guarded deletes.
  const existingDemoVendors = await Vendor.find({
    workspace_id: workspace._id,
    domain: { $regex: DEMO_SUFFIX.replace(/\./g, "\\.") + "$" },
  }).select("_id");
  const existingIds = existingDemoVendors.map((v) => v._id);
  if (existingIds.length > 0) {
    const engagements = await Engagement.find({
      workspace_id: workspace._id,
      vendor_id: { $in: existingIds },
    }).select("_id");
    const engagementIds = engagements.map((e) => e._id);
    const assessments = await Assessment.find({
      workspace_id: workspace._id,
      vendor_id: { $in: existingIds },
    }).select("_id");
    const assessmentIds = assessments.map((assessment) => assessment._id);
    await Promise.all([
      Response.deleteMany({
        workspace_id: workspace._id,
        assessment_id: { $in: assessmentIds },
      }),
      Risk.deleteMany({
        workspace_id: workspace._id,
        vendor_id: { $in: existingIds },
      }),
      Offboarding.deleteMany({
        workspace_id: workspace._id,
        vendor_id: { $in: existingIds },
      }),
      Assessment.deleteMany({
        workspace_id: workspace._id,
        _id: { $in: assessmentIds },
      }),
      Engagement.deleteMany({
        workspace_id: workspace._id,
        _id: { $in: engagementIds },
      }),
      Vendor.deleteMany({
        workspace_id: workspace._id,
        _id: { $in: existingIds },
      }),
    ]);
  }

  const templateId = new Types.ObjectId();
  const fixtureBodies = new Map<
    (typeof DEMO_EVIDENCE_FIXTURES)[number]["filename"],
    Buffer
  >();
  for (const fixture of DEMO_EVIDENCE_FIXTURES) {
    const body = await readFile(
      resolve(process.cwd(), "scripts/fixtures", fixture.filename),
    );
    validateUploadedFile({
      filename: fixture.filename,
      mime: fixture.mime,
      size: body.byteLength,
    });
    fixtureBodies.set(fixture.filename, body);
  }

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
      // ASSESSMENT-WORKFLOW-PLAN.md Stage 2 — every demo vendor needs at least one active
      // spocs[] entry or nothing here could ever OTP-log-in as it.
      spocs: [
        {
          name: `${spec.name} SPOC`,
          email: `spoc@${spec.domain}`,
          phone: "+15550100000",
          is_primary: true,
          status: "active",
        },
      ],
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

    let assessment: HydratedDocument<AssessmentDoc>;
    if (vendorIndex % 4 === 0) {
      // Portal stall: sent, past due, never submitted.
      assessment = await Assessment.create({
        workspace_id: workspace._id,
        engagement_id: engagement._id,
        vendor_id: vendor._id,
        template_id: templateId,
        template_version: 1,
        template_name: "Demo Vendor Security Review v2",
        template_snapshot: DEMO_QUESTIONS_SCHEMA,
        status: "sent",
        assigned_at: days(cycleOffset + 20),
        due_date: days(cycleOffset + 5),
        recipients: [vendor.spocs[0]!._id],
        sent_at: days(cycleOffset + 20),
        last_activity_at: days(cycleOffset + 20),
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

      const isCorrectionRound = vendorIndex === 1;
      const correctionResentAt = days(cycleOffset + 3);
      const correctionSubmittedAt = days(cycleOffset + 1);
      assessment = await Assessment.create({
        workspace_id: workspace._id,
        engagement_id: engagement._id,
        vendor_id: vendor._id,
        template_id: templateId,
        template_version: 1,
        template_name: "Demo Vendor Security Review v2",
        template_snapshot: DEMO_QUESTIONS_SCHEMA,
        status: isCorrectionRound ? "submitted" : "completed",
        assigned_at: assignedAt,
        due_date: dueDate,
        recipients: [vendor.spocs[0]!._id],
        sent_at: assignedAt,
        submitted_at: isCorrectionRound ? correctionSubmittedAt : submittedAt,
        reviewed_at: isCorrectionRound ? null : reviewedAt,
        next_review_due: isCorrectionRound ? null : nextReviewDue,
        review_round: isCorrectionRound ? 1 : 0,
        resent_by: isCorrectionRound ? admin._id : null,
        resent_at: isCorrectionRound ? correctionResentAt : null,
        last_activity_at: isCorrectionRound
          ? correctionSubmittedAt
          : reviewedAt,
      });

      const responseSpecs = buildDemoResponseSpecs(
        spec.compliantControls,
        isCorrectionRound,
      );
      const spocId = vendor.spocs[0]!._id;
      const evidenceByControl = new Map<
        string,
        Array<{
          file_key: string;
          filename: string;
          mime: string;
          size: number;
          uploaded_at: Date;
          uploaded_by: Types.ObjectId;
        }>
      >();
      for (const [fixtureIndex, fixture] of DEMO_EVIDENCE_FIXTURES.entries()) {
        const body = fixtureBodies.get(fixture.filename)!;
        const key = `${storagePrefix}/vendor-${vendorIndex}/${fixture.filename}`;
        const stored = await storage.put(key, body);
        evidenceByControl.set(fixture.controlId, [
          {
            file_key: key,
            filename: fixture.filename,
            mime: fixture.mime,
            size: stored.size,
            uploaded_at: days(cycleOffset + 24 - fixtureIndex),
            uploaded_by: spocId,
          },
        ]);
      }

      await Response.insertMany(
        responseSpecs.map((response) => ({
          workspace_id: workspace._id,
          assessment_id: assessment._id,
          control_id: response.controlId,
          question_text: response.questionText,
          response_value: response.responseValue,
          evidence: evidenceByControl.get(response.controlId) ?? [],
          answered_at: isCorrectionRound ? correctionSubmittedAt : submittedAt,
          answered_by: spocId,
          review_status: response.reviewStatus,
          reviewer_note: response.reviewerNote,
          reviewed_at: reviewedAt,
          reviewed_by: admin._id,
          review_round: response.reviewRound,
        })),
      );
    }

    if (assessment.status === "sent") continue;

    // Risks use the production service so residual scoring, assessment rollups, CAP owner
    // validation, and audit records have exactly the same shape as interactive writes.
    const reviewService = new AssessmentReviewService({
      workspaceId: workspace._id,
    });
    const failedResponses = buildDemoResponseSpecs(
      spec.compliantControls,
      vendorIndex === 1,
    ).filter((response) => response.reviewStatus === "non_compliant");
    const riskCount = Math.min(
      failedResponses.length,
      spec.tier === 1 ? 3 : spec.tier === 2 ? 2 : 1,
    );
    for (let i = 0; i < riskCount; i++) {
      const severity = severities[(vendorIndex + i) % severities.length]!;
      const ageDays = [5, 45, 75, 110][(vendorIndex + i) % 4]!;
      const isClosed = (vendorIndex + i) % 5 === 0;
      const response = failedResponses[i]!;
      const riskResult = await reviewService.raiseRisk(
        assessment._id.toString(),
        {
          control_id: response.controlId,
          title: `${spec.name}: ${severity} control gap ${i + 1}`,
          description: response.reviewerNote,
          severity,
          enterprise_risk_category: "Information Security",
          impact_level: severity === "critical" ? "critical" : "medium",
          compensating_controls:
            i % 2 === 0 ? ["Weekly management review"] : [],
        },
        admin._id,
      );

      const risk = await Risk.findOneAndUpdate(
        { workspace_id: workspace._id, _id: riskResult.risk_id },
        { $set: { created_at: days(ageDays) } },
        { returnDocument: "after" },
      );
      if (!risk)
        throw new Error(`Seeded risk disappeared: ${riskResult.risk_id}`);

      // Several real service-created risks receive real service-created CAPs. Past-due
      // open tasks are intentionally left for the production overdue detector to surface.
      const capCountForVendor = spec.tier === 1 ? 2 : spec.tier === 2 ? 1 : 0;
      if (i < capCountForVendor && !isClosed) {
        const capOverdue = (vendorIndex + i) % 3 !== 0;
        const cap = await reviewService.createCapTask(
          risk._id.toString(),
          {
            description:
              "Remediate the control gap and attach closure evidence",
            owner_type: "internal",
            owner_ref: admin._id.toString(),
            due_date: capOverdue ? days(15) : futureDays(30),
          },
          admin._id,
        );
        if (!capOverdue && (vendorIndex + i) % 2 === 0) {
          await reviewService.updateCapTask(
            risk._id.toString(),
            cap.task_id,
            { status: "closed" },
            admin._id,
          );
        }
      }

      if (isClosed) {
        await reviewService.updateRisk(
          risk._id.toString(),
          { status: "closed" },
          admin._id,
        );
        await Risk.updateOne(
          { workspace_id: workspace._id, _id: risk._id },
          { $set: { closed_at: days(Math.max(1, ageDays - 10)) } },
        );
      }
    }

    if (vendorIndex === 1) {
      await Assessment.updateOne(
        { workspace_id: workspace._id, _id: assessment._id },
        {
          $set: {
            status: "submitted",
            last_activity_at: days(cycleOffset + 1),
          },
        },
      );
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

  const seededDemoVendorIds = (
    await Vendor.find({
      workspace_id: workspace._id,
      domain: { $regex: DEMO_SUFFIX.replace(/\./g, "\\.") + "$" },
    })
      .select("_id")
      .lean()
  ).map((vendor) => vendor._id);
  const seededAssessmentIds = (
    await Assessment.find({
      workspace_id: workspace._id,
      vendor_id: { $in: seededDemoVendorIds },
    })
      .select("_id")
      .lean()
  ).map((assessment) => assessment._id);
  const [assessmentCount, responseCount, riskCount] = await Promise.all([
    Assessment.countDocuments({
      workspace_id: workspace._id,
      vendor_id: { $in: seededDemoVendorIds },
    }),
    Response.countDocuments({
      workspace_id: workspace._id,
      assessment_id: { $in: seededAssessmentIds },
    }),
    Risk.countDocuments({
      workspace_id: workspace._id,
      vendor_id: { $in: seededDemoVendorIds },
    }),
  ]);
  console.log(
    `Demo data ready: ${VENDOR_SPECS.length} vendors, ${assessmentCount} assessments, ${responseCount} responses, and ${riskCount} linked risks under workspace "${workspace.slug}".`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
