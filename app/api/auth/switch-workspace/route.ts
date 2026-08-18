import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/current-session";
import { createSessionToken } from "@/lib/auth/session";
import {
  INTERNAL_SESSION_COOKIE,
  internalSessionCookieOptions,
} from "@/lib/auth/session-cookie";
import { switchWorkspace } from "@/lib/services/workspace-membership";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { UnauthorizedError, ValidationError } from "@/lib/errors";

const switchRequestSchema = z.object({
  workspace_id: z.string().min(1),
});

export const POST = withRouteErrors(async (request: NextRequest) => {
  const session = await getCurrentSession();
  if (!session) throw new UnauthorizedError("Not authenticated");

  const body = await request.json().catch(() => null);
  const parsed = switchRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("workspace_id is required");
  }

  const newSession = await switchWorkspace(session, parsed.data.workspace_id);

  const token = await createSessionToken(newSession);
  const response = NextResponse.json({
    ok: true,
    workspace_id: newSession.workspaceId,
  });
  response.cookies.set(
    INTERNAL_SESSION_COOKIE,
    token,
    internalSessionCookieOptions,
  );
  return response;
});
