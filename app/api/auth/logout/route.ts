import { NextResponse } from "next/server";
import {
  INTERNAL_SESSION_COOKIE,
  internalSessionCookieOptions,
} from "@/lib/auth/session-cookie";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Clearing an already-expired or already-cleared session must still succeed — logout is
  // idempotent, never conditioned on the current session being valid.
  response.cookies.set(INTERNAL_SESSION_COOKIE, "", {
    ...internalSessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
