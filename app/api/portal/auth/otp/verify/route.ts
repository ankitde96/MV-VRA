import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { createPortalSessionToken } from "@/lib/auth/portal-session";
import {
  PORTAL_SESSION_COOKIE,
  portalSessionCookieOptions,
} from "@/lib/auth/portal-session-cookie";
import { verifyOtp } from "@/lib/services/portal-auth";

const verifyRequestSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

export const POST = withRouteErrors(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  const parsed = verifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", message: parsed.error.message },
      { status: 422 },
    );
  }

  const session = await verifyOtp(parsed.data);
  const token = await createPortalSessionToken(session);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    PORTAL_SESSION_COOKIE,
    token,
    portalSessionCookieOptions,
  );
  return response;
});
