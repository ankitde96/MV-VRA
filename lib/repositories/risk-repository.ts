import { Types, type QueryFilter, type UpdateQuery } from "mongoose";
import { Risk, type RiskDoc } from "@/lib/db/models/risk";
import { TenantRepository } from "./base";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

/**
 * Tenant-scoped repository for Identified Risks (`risks` collection).
 * Every query automatically injects `workspace_id`.
 */
export class RiskRepository extends TenantRepository<RiskDoc> {
  constructor(ctx: TenantContext) {
    super(Risk, ctx);
  }

  /**
   * Pushes a new CAP task onto a risk's embedded `cap_tasks` array (Phase 9). Uses `$push`
   * rather than reading-modifying-writing the whole risk document, so two CAP tasks added to
   * the same risk moments apart can never clobber one another.
   */
  pushCapTask(riskId: Types.ObjectId | string, task: Record<string, unknown>) {
    return this.model.updateOne(
      this.scope({ _id: toObjectId(riskId) } as QueryFilter<RiskDoc>),
      {
        $push: { cap_tasks: task },
      } as UpdateQuery<RiskDoc>,
    );
  }

  /**
   * Updates specific fields of exactly one embedded `cap_task`, addressed by its `task_id`,
   * via a positional `arrayFilters` update. `TenantRepository.updateOne()` doesn't expose
   * `arrayFilters`, so this bypasses it deliberately — still routed through `scope()` so the
   * tenant guard still applies to which risk document can be touched at all.
   */
  updateCapTaskFields(
    riskId: Types.ObjectId | string,
    taskId: Types.ObjectId | string,
    fields: Record<string, unknown>,
  ) {
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      setFields[`cap_tasks.$[task].${key}`] = value;
    }
    return this.model.updateOne(
      this.scope({ _id: toObjectId(riskId) } as QueryFilter<RiskDoc>),
      { $set: setFields } as UpdateQuery<RiskDoc>,
      { arrayFilters: [{ "task.task_id": toObjectId(taskId) }] },
    );
  }

  /**
   * Finds every risk in the workspace with at least one CAP task that is past its due date
   * and not yet closed — the candidate set `detectAndEscalateOverdueCaps()` walks. Filtering
   * here (rather than fetching every risk) keeps the request-driven check cheap enough to run
   * on every queue-page load, per PLAN.md Phase 9's "request-driven, no job runner" default.
   */
  findRisksWithPastDueCapTasks(now: Date) {
    return this.model.find(
      this.scope({
        cap_tasks: {
          $elemMatch: { due_date: { $lt: now }, status: { $ne: "closed" } },
        },
      } as QueryFilter<RiskDoc>),
    );
  }
}
