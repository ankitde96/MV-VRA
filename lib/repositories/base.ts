import {
  Types,
  type AnyKeys,
  type ClientSession,
  type QueryFilter,
  type Model,
  type UpdateQuery,
} from "mongoose";
import { TenantScopeError } from "@/lib/errors";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

/**
 * DATA-MODEL.md §1 / DECISIONS.md 003: the tenant boundary is enforced here, structurally,
 * not by convention. Every public method routes through `scope()`, which injects
 * workspace_id into the filter — there is no method on this class that accepts a raw
 * filter and reaches the model directly. Constructing an instance without a workspaceId
 * throws immediately; it does not silently proceed.
 */
export abstract class TenantRepository<
  T extends { workspace_id: Types.ObjectId },
> {
  protected readonly workspaceId: Types.ObjectId;

  constructor(
    protected readonly model: Model<T>,
    ctx: TenantContext,
  ) {
    if (!ctx?.workspaceId) {
      throw new TenantScopeError(
        `${this.constructor.name} constructed without a workspaceId — refusing to query`,
      );
    }
    this.workspaceId = toObjectId(ctx.workspaceId);
  }

  protected scope(filter: QueryFilter<T> = {}): QueryFilter<T> {
    return { ...filter, workspace_id: this.workspaceId } as QueryFilter<T>;
  }

  find(filter: QueryFilter<T> = {}) {
    return this.model.find(this.scope(filter));
  }

  findOne(filter: QueryFilter<T> = {}) {
    return this.model.findOne(this.scope(filter));
  }

  findById(id: string | Types.ObjectId) {
    return this.model.findOne(
      this.scope({ _id: toObjectId(id) } as QueryFilter<T>),
    );
  }

  /**
   * `session` threads a mongoose transaction through the tenant guard (DATA-MODEL.md §5) —
   * Phase 3's Vendor+Engagement write needs both created atomically. `Model.create()`
   * requires the array form when a session is passed, so this normalizes to that
   * internally rather than pushing that detail onto every caller.
   */
  async create(
    doc: Omit<AnyKeys<T>, "workspace_id">,
    opts?: { session?: ClientSession },
  ) {
    const withWorkspace = { ...doc, workspace_id: this.workspaceId };
    if (opts?.session) {
      // Mongoose's `create()` overloads don't resolve cleanly against a generic `T` here —
      // the array + session form is otherwise correct (confirmed by the passing integration
      // test in lib/services/__tests__/vendor-intake.test.ts, which exercises exactly this
      // path against a real transaction).
      const [created] = await (
        this.model.create as (
          docs: unknown[],
          options: unknown,
        ) => Promise<unknown[]>
      )([withWorkspace], { session: opts.session });
      return created as ReturnType<Model<T>["hydrate"]>;
    }
    return this.model.create(withWorkspace as AnyKeys<T>);
  }

  updateOne(
    filter: QueryFilter<T>,
    update: UpdateQuery<T>,
    opts?: { session?: ClientSession },
  ) {
    return this.model.updateOne(this.scope(filter), update, {
      session: opts?.session,
    });
  }

  count(filter: QueryFilter<T> = {}) {
    return this.model.countDocuments(this.scope(filter));
  }
}
