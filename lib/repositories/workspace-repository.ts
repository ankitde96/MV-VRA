import { Workspace } from "@/lib/db/models/workspace";
import { toObjectId } from "@/lib/tenant/context";
import type { Types } from "mongoose";

/**
 * `Workspace` doesn't fit `TenantRepository` — a workspace document *is* the tenant, so
 * there is no `workspace_id` to scope by (DATA-MODEL.md §1). This exists only so model
 * queries stay routed through the repository layer (PLAN.md §2's directory-shape rule),
 * not because a real scoping guarantee is needed here.
 */
export class WorkspaceRepository {
  findById(id: string | Types.ObjectId) {
    return Workspace.findById(toObjectId(id));
  }
}
