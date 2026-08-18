import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembership } from "@/lib/auth/require-capability";
import { dbConnect } from "@/lib/db/connect";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { AssessmentReviewService } from "@/lib/services/assessment-review";

export const GET = withRouteErrors(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership = await requireCurrentMembership();

    const { id } = await params;
    await dbConnect();

    const service = new AssessmentReviewService({
      workspaceId: membership.workspaceId,
    });
    const reviewData = await service.getAssessmentReviewData(id);

    return NextResponse.json(reviewData);
  },
);
