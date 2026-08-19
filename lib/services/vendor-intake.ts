import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { NotFoundError } from "@/lib/errors";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { EngagementRepository } from "@/lib/repositories/engagement-repository";
import { WorkspaceRepository } from "@/lib/repositories/workspace-repository";
import { recordAuditEvent } from "@/lib/audit/record-event";
import {
  scoreAndTierEngagement,
  type IntakeScoringInput,
  type RiskWeights,
  type TierThresholds,
} from "@/lib/scoring/inherent-risk";
import type { TenantContext } from "@/lib/tenant/context";
import type { VendorDoc } from "@/lib/db/models/vendor";
import type { EngagementDoc } from "@/lib/db/models/engagement";

export interface VendorIntakeInput {
  legal_name: string;
  domain: string;
  spoc: { spoc_name: string; spoc_email: string; spoc_phone: string };
  business_unit: string;
  functional_scope: string;
  expected_procurement_date: Date;
  data_classification: IntakeScoringInput["data_classification"];
  network_exposure: IntakeScoringInput["network_exposure"];
  system_access_level: IntakeScoringInput["system_access_level"];
  business_redundancy: IntakeScoringInput["business_redundancy"];
}

export interface VendorIntakeActor {
  userId: string;
  workspaceId: string;
}

/**
 * PLAN.md Phase 3 end to end: score → tier (or fail loudly, DATA-MODEL.md §4) → write
 * Vendor + Engagement atomically (DATA-MODEL.md §5 — this is the transaction that made the
 * replica-set conversion necessary, DECISIONS.md 014) → record the audit event in the same
 * transaction. No direct model access here — everything routes through a repository.
 */
export async function submitVendorIntake(
  ctx: TenantContext,
  actor: VendorIntakeActor,
  input: VendorIntakeInput,
): Promise<{
  vendor: VendorDoc & { _id: Types.ObjectId };
  engagement: EngagementDoc & { _id: Types.ObjectId };
}> {
  await dbConnect();

  const workspaceRepo = new WorkspaceRepository();
  const workspace = await workspaceRepo.findById(ctx.workspaceId);
  if (!workspace) {
    throw new NotFoundError(`Workspace ${ctx.workspaceId} not found`);
  }

  // `InferSchemaType` collapses `workspace.settings`'s nested plain-object field to the raw
  // schema-definition shape rather than the runtime value type — the same category of
  // Mongoose/TypeScript gotcha flagged in docs/features/phase-1-data-layer-and-tenant-guard.md
  // §7 for `timestamps`, just on a different field. Cast explicitly rather than fight it here.
  const settings = workspace.settings as unknown as {
    risk_weights: RiskWeights;
    tier_thresholds: TierThresholds | undefined;
    weights_version: number;
  };

  const scoringInput: IntakeScoringInput = {
    data_classification: input.data_classification,
    network_exposure: input.network_exposure,
    system_access_level: input.system_access_level,
    business_redundancy: input.business_redundancy,
  };

  const tiering = scoreAndTierEngagement(
    scoringInput,
    settings.risk_weights,
    settings.tier_thresholds,
  );

  const vendorRepo = new VendorRepository(ctx);
  const engagementRepo = new EngagementRepository(ctx);

  const session = await mongoose.startSession();
  try {
    const { vendor, engagement } = await session.withTransaction(async () => {
      const vendor = (await vendorRepo.create(
        {
          legal_name: input.legal_name,
          domain: input.domain,
          spoc: input.spoc,
          // ASSESSMENT-WORKFLOW-PLAN.md Stage 2 (D2) — every vendor needs at least one
          // active spocs[] entry from creation, since that's what OTP login resolves
          // against now; the legacy `spoc` object above is kept for compatibility but is
          // never read for that purpose again.
          spocs: [
            {
              _id: new Types.ObjectId(),
              name: input.spoc.spoc_name,
              email: input.spoc.spoc_email,
              phone: input.spoc.spoc_phone,
              is_primary: true,
              status: "active",
            },
          ],
          business_unit: input.business_unit || null,
          inherent_risk_tier: tiering.status === "tiered" ? tiering.tier : null,
          lifecycle_status: "prospective",
        },
        { session },
      )) as VendorDoc & { _id: Types.ObjectId };

      const engagement = (await engagementRepo.create(
        {
          vendor_id: vendor._id,
          business_owner_id: new Types.ObjectId(actor.userId),
          business_unit: input.business_unit,
          functional_scope: input.functional_scope,
          expected_procurement_date: input.expected_procurement_date,
          data_classification: input.data_classification,
          intake_responses: input,
          inherent_score:
            tiering.status === "tiered"
              ? {
                  total: tiering.total,
                  breakdown: tiering.breakdown,
                  weights_version: settings.weights_version,
                  weights_snapshot: settings.risk_weights,
                }
              : {
                  total: null,
                  breakdown: {},
                  weights_version: null,
                  weights_snapshot: null,
                },
          inherent_risk_tier: tiering.status === "tiered" ? tiering.tier : null,
          status: tiering.status === "tiered" ? "tiered" : "scoring_failed",
        },
        { session },
      )) as EngagementDoc & { _id: Types.ObjectId };

      await recordAuditEvent(
        {
          workspace_id: vendor.workspace_id,
          actor: {
            type: "internal",
            id: new Types.ObjectId(actor.userId),
            email: null,
          },
          action: "engagement.intake_submitted",
          entity_type: "engagement",
          entity_id: engagement._id,
          diff: {
            status: engagement.status,
            inherent_risk_tier: engagement.inherent_risk_tier,
            ...(tiering.status === "scoring_failed"
              ? { scoring_failure_reason: tiering.reason }
              : {}),
          },
        },
        { session },
      );

      return { vendor, engagement };
    });

    return { vendor, engagement };
  } finally {
    await session.endSession();
  }
}
