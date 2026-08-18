import type { ClientSession, Types } from "mongoose";
import { AuditEvent } from "@/lib/db/models/audit-event";

/**
 * First writer to `audit_events` (the model has existed since Phase 1 — CONSTRAINTS.md
 * #12 requires append-only, so this file exposes only `recordAuditEvent`, no update/delete
 * counterpart, ever). Not a `TenantRepository` subclass: `workspace_id` is nullable here
 * for cross-workspace/system events, which doesn't fit that base class's "always scoped"
 * contract.
 */
export interface AuditEventInput {
  workspace_id: Types.ObjectId | null;
  actor: {
    type: "internal" | "vendor" | "system";
    id: Types.ObjectId | null;
    email: string | null;
  };
  action: string;
  entity_type: string;
  entity_id: Types.ObjectId;
  diff?: Record<string, unknown> | null;
  request_ip?: string | null;
}

export function recordAuditEvent(
  event: AuditEventInput,
  opts?: { session?: ClientSession },
) {
  const doc = { ...event, at: new Date() };
  if (opts?.session) {
    return AuditEvent.create([doc], { session: opts.session }).then(
      ([created]) => created,
    );
  }
  return AuditEvent.create(doc);
}
