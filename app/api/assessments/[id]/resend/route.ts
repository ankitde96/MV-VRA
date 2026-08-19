import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { AssessmentReviewService } from "@/lib/services/assessment-review";

export const POST = withRouteErrors(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("assessment.review");
    const { id } = await params;
    const result = await new AssessmentReviewService({
      workspaceId: membership.workspaceId,
    }).resendQuestionnaire(id, membership.userId);
    return NextResponse.json(result);
  },
);
