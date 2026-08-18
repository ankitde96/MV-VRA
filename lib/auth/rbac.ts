import { ForbiddenError } from "@/lib/errors";

/**
 * Phase 11 (`DECISIONS.md` 024). `User.memberships[].role` (`lib/db/models/user.ts`) has
 * existed unused since Phase 1 — this is the first code that reads it for anything besides
 * picking a `workspaceId` at login.
 *
 * Capability names are the vocabulary every route/service checks against — deliberately
 * coarse-grained (not one capability per API route) so the matrix below stays readable as a
 * single table. If a future action doesn't cleanly map to one of these, add a new
 * capability rather than overloading an existing one's meaning.
 */
export type Role = "admin" | "risk_analyst" | "business_owner" | "viewer";

export type Capability =
  /** Vendor intake, SPOC edits, document upload — the "run the program" surface. */
  | "vendor.write"
  /** Template CRUD, publish, archive, version. */
  | "template.manage"
  /** Assign an assessment to an engagement. */
  | "assessment.assign"
  /** Review a submitted assessment, raise/update risks, CAP tasks. */
  | "assessment.review"
  /** Initiate/progress/complete offboarding. */
  | "offboarding.manage"
  /** Create/disable internal users, assign/revoke workspace memberships. */
  | "workspace.manage_users"
  /** Grant/revoke Cross-Workspace Document Sharing. */
  | "sharing.manage"
  /** View the executive roll-up dashboard. */
  | "rollup.view";

/**
 * `viewer` deliberately has zero write capabilities — read paths (GET routes) are never
 * capability-gated, only writes are, so a viewer's absence from every entry here is what
 * makes them read-only, not a separate "read" capability nobody would ever deny.
 */
const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set<Capability>([
    "vendor.write",
    "template.manage",
    "assessment.assign",
    "assessment.review",
    "offboarding.manage",
    "workspace.manage_users",
    "sharing.manage",
    "rollup.view",
  ]),
  risk_analyst: new Set<Capability>([
    "vendor.write",
    "template.manage",
    "assessment.assign",
    "assessment.review",
    "offboarding.manage",
    "rollup.view",
  ]),
  business_owner: new Set<Capability>(["vendor.write", "assessment.assign"]),
  viewer: new Set<Capability>([]),
};

export function roleHasCapability(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.has(capability) ?? false;
}

/**
 * Called at the top of a route handler or service method, right after resolving the
 * caller's current-workspace role (`getCurrentMembership()`,
 * `lib/auth/current-membership.ts`). Throws rather than returning a boolean so a forgotten
 * check fails loudly in a route test instead of silently no-op'ing.
 */
export function requireCapability(role: Role, capability: Capability): void {
  if (!roleHasCapability(role, capability)) {
    throw new ForbiddenError(
      `Role '${role}' does not have the '${capability}' capability`,
    );
  }
}
