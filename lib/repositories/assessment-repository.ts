import {
  type ClientSession,
  type QueryFilter,
  type Types,
  type UpdateQuery,
} from "mongoose";
import { Assessment, type AssessmentDoc } from "@/lib/db/models/assessment";
import { TenantRepository } from "./base";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

/**
 * PLAN.md Phase 6. Read on both sides of the tenant boundary: the internal vendor-detail
 * page lists a vendor's assessments scoped by workspace, and the vendor portal
 * (app/(portal)/portal/page.tsx) further filters `find({ vendor_id })` down to the one
 * vendor the session is scoped to — the workspace scope from this class plus the vendor
 * filter from the caller together enforce both boundaries (`FLOW.md` F2 gap b).
 */
export class AssessmentRepository extends TenantRepository<AssessmentDoc> {
  constructor(ctx: TenantContext) {
    super(Assessment, ctx);
  }

  /**
   * Phase 10 — the sole writer of `status: 'archived'`. Filtered to `status !== 'archived'`
   * so a document already archived can never be re-archived or, more importantly, so this
   * is the one and only place `archived` gets set — no other update path in the codebase
   * writes this value (`CONSTRAINTS.md` #12).
   */
  archive(id: string | Types.ObjectId, opts?: { session?: ClientSession }) {
    return this.updateOne(
      {
        _id: toObjectId(id),
        status: { $ne: "archived" },
      } as QueryFilter<AssessmentDoc>,
      { $set: { status: "archived" } } as UpdateQuery<AssessmentDoc>,
      opts,
    );
  }
}
