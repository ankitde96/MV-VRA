import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { questionsSchemaSchema } from "@/lib/questionnaire/schema";
import { updateAssessmentChecklist } from "@/lib/services/assessment-assignment";

const updateChecklistSchema = z.object({
  questions_schema: questionsSchemaSchema,
  expected_updated_at: z.coerce.date(),
});

export const PATCH = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("assessment.assign");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = updateChecklistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: parsed.error.message },
        { status: 422 },
      );
    }

    const assessment = await updateAssessmentChecklist(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
      parsed.data.questions_schema,
      parsed.data.expected_updated_at,
    );
    return NextResponse.json({
      assessment: {
        id,
        status: assessment?.status,
        updated_at: assessment?.updated_at.toISOString(),
      },
    });
  },
);
