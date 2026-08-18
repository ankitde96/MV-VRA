import { NextResponse, type NextRequest } from "next/server";
import { getCurrentPortalSession } from "@/lib/auth/current-portal-session";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { submitAssessment } from "@/lib/services/portal-assessment";

export const POST = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const session = await getCurrentPortalSession();
    if (!session) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { id } = await params;
    const assessment = await submitAssessment(session, id);
    return NextResponse.json({
      assessment: { id: assessment._id.toString(), status: assessment.status },
    });
  },
);
