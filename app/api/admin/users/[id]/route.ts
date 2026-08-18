import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import {
  removeWorkspaceUser,
  updateWorkspaceUserRole,
} from "@/lib/services/admin-users";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { ValidationError } from "@/lib/errors";

const updateRoleSchema = z.object({
  role: z.enum(["admin", "risk_analyst", "business_owner", "viewer"]),
});

export const PATCH = withRouteErrors<{ params: Promise<{ id: string }> }>(
  async (request: NextRequest, context) => {
    const membership = await requireCurrentMembershipWithCapability(
      "workspace.manage_users",
    );
    const { id } = await context.params;

    const body = await request.json().catch(() => null);
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("role is required");
    }

    const result = await updateWorkspaceUserRole(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
      parsed.data.role,
    );
    return NextResponse.json(result);
  },
);

export const DELETE = withRouteErrors<{ params: Promise<{ id: string }> }>(
  async (_request: NextRequest, context) => {
    const membership = await requireCurrentMembershipWithCapability(
      "workspace.manage_users",
    );
    const { id } = await context.params;

    const result = await removeWorkspaceUser(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
    );
    return NextResponse.json(result);
  },
);
