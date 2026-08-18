import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { dbConnect } from "@/lib/db/connect";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import {
  AssessmentReviewService,
  type UpdateCapTaskInput,
} from "@/lib/services/assessment-review";

export const PATCH = withRouteErrors(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string; taskId: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("assessment.review");

    const { id, taskId } = await params;
    const body = (await req.json()) as UpdateCapTaskInput;

    await dbConnect();
    const service = new AssessmentReviewService({
      workspaceId: membership.workspaceId,
    });
    const result = await service.updateCapTask(
      id,
      taskId,
      body,
      membership.userId,
    );

    return NextResponse.json(result);
  },
);
