import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { sendAssessment } from "@/lib/services/assessment-assignment";

const sendSchema = z.object({ spoc_ids: z.array(z.string()).min(1) });

export const POST = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("assessment.assign");
    const body = sendSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json(
        { error: "validation_error", message: "Choose at least one recipient" },
        { status: 422 },
      );
    }
    const { id } = await params;
    const assessment = await sendAssessment(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
      { spocIds: body.data.spoc_ids },
    );
    return NextResponse.json({ assessment });
  },
);
