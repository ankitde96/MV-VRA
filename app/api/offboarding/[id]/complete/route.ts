import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { completeOffboarding } from "@/lib/services/offboarding";

export const POST = withRouteErrors(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("offboarding.manage");

    const { id } = await params;
    const result = await completeOffboarding(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
    );

    return NextResponse.json(result);
  },
);
