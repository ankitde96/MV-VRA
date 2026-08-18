import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/current-session";
import { listMembershipsForUser } from "@/lib/services/workspace-membership";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { UnauthorizedError } from "@/lib/errors";

export const GET = withRouteErrors(async () => {
  const session = await getCurrentSession();
  if (!session) throw new UnauthorizedError("Not authenticated");

  const memberships = await listMembershipsForUser(session.userId);
  return NextResponse.json({
    memberships,
    current_workspace_id: session.workspaceId,
  });
});
