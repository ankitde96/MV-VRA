import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import {
  addWorkspaceUser,
  listWorkspaceUsers,
} from "@/lib/services/admin-users";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { ValidationError } from "@/lib/errors";

const addUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "risk_analyst", "business_owner", "viewer"]),
  password: z.string().min(8),
});

export const GET = withRouteErrors(async () => {
  const membership = await requireCurrentMembershipWithCapability(
    "workspace.manage_users",
  );
  const users = await listWorkspaceUsers({
    workspaceId: membership.workspaceId,
  });
  return NextResponse.json({ users });
});

export const POST = withRouteErrors(async (request: NextRequest) => {
  const membership = await requireCurrentMembershipWithCapability(
    "workspace.manage_users",
  );

  const body = await request.json().catch(() => null);
  const parsed = addUserSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      "email, name, role, and a password of at least 8 characters are required",
    );
  }

  const result = await addWorkspaceUser(
    { workspaceId: membership.workspaceId },
    { userId: membership.userId },
    parsed.data,
  );
  return NextResponse.json(result, { status: 201 });
});
