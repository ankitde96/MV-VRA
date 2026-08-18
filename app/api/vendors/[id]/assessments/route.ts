import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { assignAssessment } from "@/lib/services/assessment-assignment";

const assignRequestSchema = z.object({
  engagement_id: z.string().min(1),
  template_id: z.string().min(1),
});

export const POST = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("assessment.assign");

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = assignRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: parsed.error.message },
        { status: 422 },
      );
    }

    const assessment = await assignAssessment(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      {
        vendorId: id,
        engagementId: parsed.data.engagement_id,
        templateId: parsed.data.template_id,
      },
    );

    return NextResponse.json(
      {
        assessment: {
          id: assessment._id.toString(),
          status: assessment.status,
          template_version: assessment.template_version,
        },
      },
      { status: 201 },
    );
  },
);
