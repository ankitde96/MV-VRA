import { NextResponse } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { dbConnect } from "@/lib/db/connect";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { AssessmentReviewService } from "@/lib/services/assessment-review";

/**
 * PLAN.md Phase 9 exit criterion: "an overdue CAP surfaces in a queue and escalates once,
 * without a job runner." This is the job runner's replacement — every load of the overdue
 * queue re-runs detection, but `detectAndEscalateOverdueCaps()`'s `escalated_at` stamp makes
 * repeated calls idempotent for the escalation email itself. Gated on `assessment.review`
 * (Phase 11) even though it's a GET — every call can write `escalated_at` and send an email,
 * so a `viewer` shouldn't be able to trigger it just by loading the queue.
 */
export const GET = withRouteErrors(async () => {
  const membership =
    await requireCurrentMembershipWithCapability("assessment.review");

  await dbConnect();
  const service = new AssessmentReviewService({
    workspaceId: membership.workspaceId,
  });
  const items = await service.detectAndEscalateOverdueCaps(membership.userId);

  return NextResponse.json({ items });
});
