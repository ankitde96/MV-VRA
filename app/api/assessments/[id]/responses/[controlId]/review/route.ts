import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { AssessmentReviewService } from "@/lib/services/assessment-review";

const bodySchema = z.object({
  review_status: z.enum(["compliant", "non_compliant"]),
  reviewer_note: z.string().optional(),
});

export const PATCH = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; controlId: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("assessment.review");
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success)
      return NextResponse.json({ error: "validation_error" }, { status: 422 });
    const { id, controlId } = await params;
    const response = await new AssessmentReviewService({
      workspaceId: membership.workspaceId,
    }).markResponseReview(id, controlId, body.data, membership.userId);
    return NextResponse.json({ response });
  },
);
