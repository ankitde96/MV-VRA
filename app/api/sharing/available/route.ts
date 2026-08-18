import { NextResponse } from "next/server";
import { requireCurrentMembership } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { listSharesAvailableToMe } from "@/lib/services/sharing";

/**
 * Read-only — any workspace member (including `viewer`) can see what has been shared with
 * them, the whole point of Cross-Workspace Document Sharing being reuse. Only *granting* a
 * new share requires `sharing.manage` (`POST /api/sharing`).
 */
export const GET = withRouteErrors(async () => {
  const membership = await requireCurrentMembership();
  const shares = await listSharesAvailableToMe({
    workspaceId: membership.workspaceId,
  });
  return NextResponse.json({ shares });
});
