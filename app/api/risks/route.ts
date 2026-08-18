import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembership } from "@/lib/auth/require-capability";
import { dbConnect } from "@/lib/db/connect";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { AssessmentReviewService } from "@/lib/services/assessment-review";

export const GET = withRouteErrors(async (req: NextRequest) => {
  const membership = await requireCurrentMembership();

  const { searchParams } = new URL(req.url);
  const filter = {
    vendor_id: searchParams.get("vendor_id") ?? undefined,
    severity: searchParams.get("severity") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    category: searchParams.get("category") ?? undefined,
  };

  await dbConnect();
  const service = new AssessmentReviewService({
    workspaceId: membership.workspaceId,
  });
  const result = await service.listWorkspaceRisks(filter);

  return NextResponse.json(result);
});
