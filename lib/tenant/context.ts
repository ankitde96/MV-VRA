import { Types } from "mongoose";

/**
 * The only thing that authorizes a repository to touch tenant data. Built by the auth layer
 * (Phase 2) from the caller's session — never constructed from a client-supplied parameter.
 */
export interface TenantContext {
  workspaceId: string | Types.ObjectId;
}

export function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return id instanceof Types.ObjectId ? id : new Types.ObjectId(id);
}
