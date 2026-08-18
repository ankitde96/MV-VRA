import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { dbConnect } from "@/lib/db/connect";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import {
  AssessmentReviewService,
  type RaiseRiskInput,
} from "@/lib/services/assessment-review";

export const POST = withRouteErrors(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const membership =
      await requireCurrentMembershipWithCapability("assessment.review");

    const { id } = await params;
    const body = (await req.json()) as RaiseRiskInput;

    await dbConnect();
    const service = new AssessmentReviewService({
      workspaceId: membership.workspaceId,
    });
    const result = await service.raiseRisk(id, body, membership.userId);

    return NextResponse.json(result, { status: 201 });
  },
);
