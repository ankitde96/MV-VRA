import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { getRequestIp } from "@/lib/http/request-ip";
import { requestOtp } from "@/lib/services/portal-auth";

const requestSchema = z.object({ email: z.string().email() });

/**
 * `FLOW.md` F2 gap (a): the response is `{ ok: true }` whether or not `email` matches a
 * vendor SPOC — `requestOtp()` never throws for "no such vendor," only for rate limiting,
 * so there is exactly one success path here regardless of which happened inside the
 * service.
 */
export const POST = withRouteErrors(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", message: parsed.error.message },
      { status: 422 },
    );
  }

  await requestOtp({
    email: parsed.data.email,
    requestIp: getRequestIp(request),
  });

  return NextResponse.json({ ok: true });
});
