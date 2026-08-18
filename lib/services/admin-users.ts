import argon2 from "argon2";
import { dbConnect } from "@/lib/db/connect";
import { User } from "@/lib/db/models/user";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { recordAuditEvent } from "@/lib/audit/record-event";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";
import type { Role } from "@/lib/auth/rbac";

export interface AdminActor {
  userId: string;
}

export interface WorkspaceUserListItem {
  user_id: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "disabled";
}

/**
 * Every internal user, still a single global collection (`DATA-MODEL.md` §2) — this lists
 * only the ones with a membership in `ctx.workspaceId`, the workspace-scoped view an admin
 * on the user-management page actually needs, never the whole `User` collection across every
 * tenant.
 */
export async function listWorkspaceUsers(
  ctx: TenantContext,
): Promise<WorkspaceUserListItem[]> {
  await dbConnect();
  const workspaceId = toObjectId(ctx.workspaceId);
  const users = await User.find({
    "memberships.workspace_id": workspaceId,
  }).lean();

  return users.map((user) => {
    const membership = user.memberships.find((m) =>
      m.workspace_id.equals(workspaceId),
    );
    return {
      user_id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: (membership?.role ?? "viewer") as Role,
      status: user.status,
    };
  });
}

export interface AddWorkspaceUserInput {
  email: string;
  name: string;
  role: Role;
  /** Admin sets the initial password directly (`DECISIONS.md` 024) — no invite-email flow. */
  password: string;
}

/**
 * If `email` already belongs to an existing `User` (this workspace or another one), this
 * grants them a membership in `ctx.workspaceId` rather than creating a duplicate account —
 * `User.email` is globally unique (`lib/db/models/user.ts`'s index), so "the user already
 * exists" is a normal case, not an error, the first time an admin adds someone who's already
 * a member of a sibling workspace.
 */
export async function addWorkspaceUser(
  ctx: TenantContext,
  actor: AdminActor,
  input: AddWorkspaceUserInput,
) {
  if (input.password.length < 8) {
    throw new ValidationError("Password must be at least 8 characters");
  }

  await dbConnect();
  const workspaceId = toObjectId(ctx.workspaceId);
  const email = input.email.trim().toLowerCase();

  const existing = await User.findOne({ email });
  if (existing) {
    const alreadyMember = existing.memberships.some((m) =>
      m.workspace_id.equals(workspaceId),
    );
    if (alreadyMember) {
      throw new ValidationError(
        "This user already has a membership in this workspace",
      );
    }
    existing.memberships.push({ workspace_id: workspaceId, role: input.role });
    await existing.save();

    await recordAuditEvent({
      workspace_id: workspaceId,
      actor: { type: "internal", id: toObjectId(actor.userId), email: null },
      action: "workspace.membership_added",
      entity_type: "User",
      entity_id: existing._id,
      diff: { email, role: input.role },
    });

    return {
      user_id: existing._id.toString(),
      email,
      role: input.role,
      created: false,
    };
  }

  const passwordHash = await argon2.hash(input.password);
  const created = await User.create({
    email,
    name: input.name.trim(),
    password_hash: passwordHash,
    memberships: [{ workspace_id: workspaceId, role: input.role }],
    status: "active",
  });

  await recordAuditEvent({
    workspace_id: workspaceId,
    actor: { type: "internal", id: toObjectId(actor.userId), email: null },
    action: "workspace.user_created",
    entity_type: "User",
    entity_id: created._id,
    diff: { email, role: input.role },
  });

  return {
    user_id: created._id.toString(),
    email,
    role: input.role,
    created: true,
  };
}

export async function updateWorkspaceUserRole(
  ctx: TenantContext,
  actor: AdminActor,
  targetUserId: string,
  role: Role,
) {
  await dbConnect();
  const workspaceId = toObjectId(ctx.workspaceId);

  const user = await User.findOne({
    _id: targetUserId,
    "memberships.workspace_id": workspaceId,
  });
  if (!user) {
    throw new NotFoundError("User not found in this workspace");
  }

  const membership = user.memberships.find((m) =>
    m.workspace_id.equals(workspaceId),
  );
  if (!membership) {
    throw new NotFoundError("User not found in this workspace");
  }
  const previousRole = membership.role;
  membership.role = role;
  await user.save();

  await recordAuditEvent({
    workspace_id: workspaceId,
    actor: { type: "internal", id: toObjectId(actor.userId), email: null },
    action: "workspace.membership_role_changed",
    entity_type: "User",
    entity_id: user._id,
    diff: { previous_role: previousRole, new_role: role },
  });

  return { user_id: user._id.toString(), role };
}

/**
 * Removes only this workspace's membership, never the `User` document itself — the same
 * account may still hold a membership in a sibling workspace. A caller who wants to disable
 * the account globally isn't served by this MVP pass; scoped deliberately, see
 * `docs/features/phase-11-multi-workspace-rbac-sharing-and-executive-rollup.md` §11.
 */
export async function removeWorkspaceUser(
  ctx: TenantContext,
  actor: AdminActor,
  targetUserId: string,
) {
  if (targetUserId === actor.userId) {
    throw new ValidationError(
      "You cannot remove your own membership from this workspace",
    );
  }

  await dbConnect();
  const workspaceId = toObjectId(ctx.workspaceId);

  const user = await User.findOne({
    _id: targetUserId,
    "memberships.workspace_id": workspaceId,
  });
  if (!user) {
    throw new NotFoundError("User not found in this workspace");
  }

  user.memberships.pull({ workspace_id: workspaceId });
  await user.save();

  await recordAuditEvent({
    workspace_id: workspaceId,
    actor: { type: "internal", id: toObjectId(actor.userId), email: null },
    action: "workspace.membership_removed",
    entity_type: "User",
    entity_id: user._id,
    diff: null,
  });

  return { user_id: user._id.toString(), removed: true };
}
