import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { dbConnect } from "@/lib/db/connect";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { AssessmentReviewService } from "@/lib/services/assessment-review";

export const POST = withRouteErrors(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("assessment.review");

    const { id } = await params;
    await dbConnect();

    const service = new AssessmentReviewService({
      workspaceId: membership.workspaceId,
    });
    const result = await service.completeReview(id, membership.userId);

    return NextResponse.json(result);
  },
);
