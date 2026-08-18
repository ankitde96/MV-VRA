import { Engagement, type EngagementDoc } from "@/lib/db/models/engagement";
import { TenantRepository } from "./base";
import type { TenantContext } from "@/lib/tenant/context";

/**
 * Phase 3's write path (lib/services/vendor-intake.ts) creates the Engagement in the same
 * transaction as the Vendor via TenantRepository.create()'s session param.
 */
export class EngagementRepository extends TenantRepository<EngagementDoc> {
  constructor(ctx: TenantContext) {
    super(Engagement, ctx);
  }
}
