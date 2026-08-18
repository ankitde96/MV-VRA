import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { login } from "@/lib/auth/login";
import { createSessionToken } from "@/lib/auth/session";
import {
  INTERNAL_SESSION_COOKIE,
  internalSessionCookieOptions,
} from "@/lib/auth/session-cookie";

const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 422 });
  }

  const session = await login(parsed.data.email, parsed.data.password);
  if (!session) {
    // Generic error regardless of whether the email or the password was wrong — the same
    // discipline FLOW.md F2 requires of the vendor OTP path, applied here too even though
    // it isn't the externally-reachable surface.
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = await createSessionToken(session);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    INTERNAL_SESSION_COOKIE,
    token,
    internalSessionCookieOptions,
  );
  return response;
}
