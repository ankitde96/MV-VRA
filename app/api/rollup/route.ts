import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/current-session";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { UnauthorizedError } from "@/lib/errors";
import { getExecutiveRollup } from "@/lib/services/executive-rollup";

/**
 * Deliberately calls `getCurrentSession()` directly, not `requireCurrentMembership()` — the
 * roll-up's authorization is inherently cross-workspace (`FLOW.md` F6), so there is no
 * single "current membership" to gate the whole route on. Only `session.userId` is used;
 * `getExecutiveRollup()` re-derives every workspace and role itself, per workspace, from the
 * database.
 */
export const GET = withRouteErrors(async () => {
  const session = await getCurrentSession();
  if (!session) throw new UnauthorizedError("Not authenticated");

  const result = await getExecutiveRollup(session.userId);
  return NextResponse.json(result);
});
