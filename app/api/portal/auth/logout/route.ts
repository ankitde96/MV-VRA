import { NextResponse } from "next/server";
import {
  PORTAL_SESSION_COOKIE,
  portalSessionCookieOptions,
} from "@/lib/auth/portal-session-cookie";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PORTAL_SESSION_COOKIE, "", {
    ...portalSessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
