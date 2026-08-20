import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { dbConnect } from "@/lib/db/connect";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { AssessmentReviewService } from "@/lib/services/assessment-review";

export const POST = withRouteErrors(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const membership =
      await requireCurrentMembershipWithCapability("assessment.review");

    const { id } = await params;
    await dbConnect();

    const service = new AssessmentReviewService({
      workspaceId: membership.workspaceId,
    });
    const input = z
      .object({ override_incomplete_cap_tasks: z.boolean().default(false) })
      .parse(await req.json().catch(() => ({})));
    const result = await service.completeReview(id, membership.userId, input);

    return NextResponse.json(result);
  },
);
