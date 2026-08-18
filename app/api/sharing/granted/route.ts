import { NextResponse } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { listSharesGrantedByMe } from "@/lib/services/sharing";

export const GET = withRouteErrors(async () => {
  const membership =
    await requireCurrentMembershipWithCapability("sharing.manage");
  const shares = await listSharesGrantedByMe({
    workspaceId: membership.workspaceId,
  });
  return NextResponse.json({ shares });
});
